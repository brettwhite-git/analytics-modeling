# Post-render: R draws every plot as SVG and PNG, but a page uses at most one of them (a redrawn plot
# is inside the HTML already). Delete the figure files no page refers to, so they are not published.
site <- "_site"
pages <- list.files(site, pattern = "\\.html$", full.names = TRUE)
html <- paste(vapply(pages, function(p) paste(readLines(p, warn = FALSE), collapse = "\n"), ""), collapse = "\n")
figures <- list.files(site, pattern = "\\.(svg|png)$", recursive = TRUE, full.names = TRUE)
figures <- figures[grepl("_files/figure-html/", figures)]
unused <- figures[!vapply(sub(paste0("^", site, "/"), "", figures), function(f) grepl(f, html, fixed = TRUE), logical(1))]
unlink(unused)
message("ink/prune.R: removed ", length(unused), " unused figure files, kept ", length(figures) - length(unused))
