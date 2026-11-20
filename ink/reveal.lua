-- Callouts, our way. Quarto's own callouts need its Bootstrap theme, which this site does not load,
-- so this filter runs first and turns every callout div into plain markup that ink/site.css styles:
--   ::: {.callout-note collapse="true" title="Answer"}   ->  <details class="reveal"><summary>Answer</summary> ... </details>
--   ::: {.callout-warning}  (### A heading inside is used as the title)  ->  <div class="note note-warning"> ... </div>

local function escape(s)
  return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

function Div(el)
  local kind = nil
  for _, c in ipairs(el.classes) do
    local k = c:match("^callout%-(%a+)$")
    if k then kind = k end
  end
  if not kind then return nil end

  local blocks = el.content
  local title = el.attributes["title"]
  if not title and #blocks > 0 and blocks[1].t == "Header" then
    title = pandoc.utils.stringify(blocks[1])
    blocks:remove(1)
  end
  if not title then title = kind:sub(1, 1):upper() .. kind:sub(2) end

  if el.attributes["collapse"] == "true" then
    local out = pandoc.List({ pandoc.RawBlock("html", '<details class="reveal"><summary>' .. escape(title) .. "</summary>") })
    out:extend(blocks)
    out:insert(pandoc.RawBlock("html", "</details>"))
    return out
  end

  local out = pandoc.List({ pandoc.RawBlock("html", '<div class="note note-' .. kind .. '"><p class="note__title">' .. escape(title) .. "</p>") })
  out:extend(blocks)
  out:insert(pandoc.RawBlock("html", "</div>"))
  return out
end
