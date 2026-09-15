# FoodLink — Mid-Term Report

`main.pdf` is the compiled UCS503P mid-term (prototype-stage) report, typeset with the
official TIET Overleaf template class (`tietreport.cls` v1.0.4, copied unchanged).

## Layout

| Path | Contents |
|---|---|
| `main.tex` | Template preamble and title page; inputs the chapters |
| `chapters/01-…06-*.tex` | Introduction · Methodology and Design · Results and Evaluation · Feasibility Report · Conclusion · UML diagrams and use case scenarios |
| `references.bib` | biblatex (biber) bibliography |
| `diagrams/*.tex` | TikZ sources of the use case, class and activity diagrams |
| `diagrams/*.pdf` | Diagrams compiled from those sources (included by `main.tex`) |

## Build

```bash
cd report/diagrams && pdflatex use-case.tex && pdflatex class-diagram.tex && pdflatex activity-diagram.tex
cd .. && pdflatex main.tex && biber main && pdflatex main.tex && pdflatex main.tex
```

The same sources compile on Overleaf.

## Notes

- Tables use `table` + `tabular`, as the template does. `longtable` 4.24 in the local
  MiKTeX (LaTeX 2025-11-01) reports "Infinite glue shrinkage found in box being split" at
  every page break, so no long tables are used.
- Local compilation needed the MiKTeX packages `titlesec`, `fancyhdr`, `logreq` and `grfext`.
- Facts about the system were verified against the repository at commit `e588b35`.
