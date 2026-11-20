-- R plots, our way. R draws each plot as SVG (svglite) and as PNG. This filter puts the SVG itself
-- into the page, so ink/ink-plot.js can redraw it by hand in the browser (rough strokes, hatching,
-- marks, site type, both themes). A dense plot is simplified first; the PNG is only a last resort.
--   ![caption](chapter_files/figure-html/plot-x-1.svg)
--     ->  <figure class="ink-plot"><div class="ink-plot__stage" data-ink-plot> <svg>...</svg> </div><figcaption>caption</figcaption></figure>

local MAX_BYTES = 260000      -- above this the SVG is thousands of marks: not worth redrawing one by one

local function read(path)
  local f = io.open(path, "rb")
  if not f then return nil end
  local s = f:read("a")
  f:close()
  return s
end

local function escape(s)
  return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

-- A dense plot shades a region with tens of thousands of tiny squares (a grid of predictions).
-- Merge each row of same-coloured squares into strips, so the page carries the region's shape,
-- not every cell; ink/ink-plot.js hatches each region as one area.
local function median(t)
  if #t == 0 then return nil end
  table.sort(t)
  return t[math.floor((#t + 1) / 2)]
end

local function simplify(svg)
  -- every panel R drew has a clip rectangle; a cell belongs to the panel whose group it is in
  local clips = {}
  for id, x, y, w, h in svg:gmatch("<clipPath id='([^']+)'>%s*<rect x='([-%d%.]+)' y='([-%d%.]+)' width='([-%d%.]+)' height='([-%d%.]+)' />") do
    clips[id] = { x0 = tonumber(x), y0 = tonumber(y), x1 = tonumber(x) + tonumber(w), y1 = tonumber(y) + tonumber(h) }
  end

  local cells, clip = {}, nil
  local function cell(x0, y0, x1, y1, style)
    local fill = style:match("fill: (#%x+)")
    if not fill or fill:upper() == "#FFFFFF" then return nil end
    if (x1 - x0) > 8 or (y1 - y0) > 8 then return nil end
    if style:match("stroke: #") then return nil end
    cells[#cells + 1] = { x = (x0 + x1) / 2, y = (y0 + y1) / 2, fill = fill, clip = clip,
      op = tonumber(style:match("fill%-opacity: ([%d%.]+)")) or 1 }
    return ""
  end
  local function strip_cells(body)
    body = body:gsub("<polygon points='([^']*)' style='([^']*)' />\n?", function(points, style)
      local n, x0, y0, x1, y1 = 0, math.huge, math.huge, -math.huge, -math.huge
      for x, y in points:gmatch("([-%d%.]+),([-%d%.]+)") do
        x, y = tonumber(x), tonumber(y); n = n + 1
        if x < x0 then x0 = x end; if x > x1 then x1 = x end
        if y < y0 then y0 = y end; if y > y1 then y1 = y end
      end
      if n ~= 4 then return nil end
      return cell(x0, y0, x1, y1, style)
    end)
    body = body:gsub("<rect x='([-%d%.]+)' y='([-%d%.]+)' width='([-%d%.]+)' height='([-%d%.]+)' style='([^']*)' />\n?", function(x, y, w, h, style)
      x, y, w, h = tonumber(x), tonumber(y), tonumber(w), tonumber(h)
      return cell(x, y, x + w, y + h, style)
    end)
    return body
  end
  -- svglite's clip groups are flat (never nested), so each one can be handled on its own
  svg = svg:gsub("(<g clip%-path='url%(#([^']+)%)'>)(.-)(</g>)", function(open, id, body, close)
    clip = clips[id]
    return open .. strip_cells(body) .. close
  end)
  if #cells < 500 then return nil end

  -- rows of the grid within each panel, and the spacing between neighbours
  local rows, ys, seen = {}, {}, {}
  for _, c in ipairs(cells) do
    local key = tostring(c.clip) .. string.format("|%.1f", c.y)
    if not rows[key] then rows[key] = {} end
    table.insert(rows[key], c)
    local yk = string.format("%.1f", c.y)
    if not seen[yk] then seen[yk] = true; ys[#ys + 1] = c.y end
  end
  table.sort(ys)
  local dys, dxs = {}, {}
  for i = 2, #ys do if ys[i] - ys[i - 1] > 0.05 then dys[#dys + 1] = ys[i] - ys[i - 1] end end
  for _, row in pairs(rows) do
    table.sort(row, function(a, b) return a.x < b.x end)
    for i = 2, math.min(#row, 40) do if row[i].x - row[i - 1].x > 0.05 then dxs[#dxs + 1] = row[i].x - row[i - 1].x end end
  end
  local dy, dx = median(dys) or 2, median(dxs) or 2

  local out = {}
  for _, row in pairs(rows) do
    local i = 1
    while i <= #row do
      local j = i
      while j < #row and row[j + 1].fill == row[i].fill and row[j + 1].x - row[j].x < dx * 1.8 do j = j + 1 end
      -- one strip, trimmed to its panel
      local x0, x1, y0, y1 = row[i].x - dx / 2, row[j].x + dx / 2, row[i].y - dy / 2, row[i].y + dy / 2
      local c = row[i].clip
      if c then
        x0, x1 = math.max(x0, c.x0), math.min(x1, c.x1)
        y0, y1 = math.max(y0, c.y0), math.min(y1, c.y1)
      end
      if x1 - x0 > 0.2 and y1 - y0 > 0.2 then
        out[#out + 1] = string.format("<rect data-region='1' x='%.2f' y='%.2f' width='%.2f' height='%.2f' style='stroke: none; fill: %s; fill-opacity: %.2f;' />",
          x0, y0, x1 - x0, y1 - y0, row[i].fill, row[i].op)
      end
      i = j + 1
    end
  end
  -- the strips go in right after the page background (the first group): under the points and axes
  local at = svg:find("</g>", 1, true)
  if not at then return nil end
  return svg:sub(1, at + 3) .. "\n<g data-regions='1'>\n" .. table.concat(out, "\n") .. "\n</g>" .. svg:sub(at + 4)
end

-- the image, redrawable or not, as a block
local function plot(img, caption)
  if not img.src:match("%.svg$") then return nil end
  local svg = read(img.src)
  if svg and #svg > MAX_BYTES then svg = simplify(svg) end
  if not svg or #svg > MAX_BYTES then
    img.src = img.src:gsub("%.svg$", ".png")
    img.classes:insert("ink-plot-flat")
    return false
  end
  svg = svg:gsub("^%s*<%?xml.-%?>%s*", "")
  local html = '<figure class="ink-plot"><div class="ink-plot__stage" data-ink-plot>' .. svg .. "</div>"
  if caption ~= "" then html = html .. "<figcaption>" .. escape(caption) .. "</figcaption>" end
  return pandoc.RawBlock("html", html .. "</figure>")
end

local function only_image(blocks_or_inlines)
  if #blocks_or_inlines ~= 1 then return nil end
  local x = blocks_or_inlines[1]
  if x.t == "Image" then return x end
  if (x.t == "Plain" or x.t == "Para") and #x.content == 1 and x.content[1].t == "Image" then return x.content[1] end
  return nil
end

-- a plot with a caption arrives as a Figure, one without as a paragraph holding an image
function Figure(el)
  local img = only_image(el.content)
  if not img then return nil end
  local block = plot(img, pandoc.utils.stringify(el.caption.long))
  if block then return block end
  return el
end

function Para(el)
  local img = only_image(el.content)
  if not img then return nil end
  local block = plot(img, pandoc.utils.stringify(img.caption))
  if block then return block end
  return el
end
