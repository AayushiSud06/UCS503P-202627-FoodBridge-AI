# UML Documentation Package — FoodLink AI

UML system-design documentation for the **current** FoodLink implementation,
prepared for academic submission.

## Contents

| File | Artefact |
| --- | --- |
| [`FoodLink-UML.md`](FoodLink-UML.md) | The submission document: actors, use case scenarios, activity and class model, modeling notes, verification record |
| [`FoodLink-Use-Case-Scenarios.md`](FoodLink-Use-Case-Scenarios.md) | **Use Case Scenarios**, standalone — all 24 actor-driven use cases in full template form |
| `FoodLink-Use-Case-Scenarios.pdf` | The same document, print-ready (A4, 19 pages) |
| `diagrams/*.drawio` | The same three diagrams as editable diagrams.net files |
| [`diagrams/01-use-case.puml`](diagrams/01-use-case.puml) | **Use Case Diagram** — 6 actors, 27 use cases, system boundary "FoodLink AI" |
| [`diagrams/02-activity-donation-lifecycle.puml`](diagrams/02-activity-donation-lifecycle.puml) | **Activity Diagram** — the food donation lifecycle across 4 swimlanes |
| [`diagrams/03-class-domain-model.puml`](diagrams/03-class-domain-model.puml) | **Class Diagram** — 6 entities, 2 enumerations, matching service |

Each diagram ships in four forms. PlantUML names its output after the `@startuml`
identifier rather than the source filename:

| PlantUML source | Editable (diagrams.net) | Rendered |
| --- | --- | --- |
| `01-use-case.puml` | `FoodLink-UseCase.drawio` | `FoodLink-UseCase.svg` · `.png` |
| `02-activity-donation-lifecycle.puml` | `FoodLink-Activity-DonationLifecycle.drawio` | `FoodLink-Activity-DonationLifecycle.svg` · `.png` |
| `03-class-domain-model.puml` | `FoodLink-ClassDiagram.drawio` | `FoodLink-ClassDiagram.svg` · `.png` |

Prefer the SVG for submission — it stays sharp at any scale, which matters most for
the use case diagram, which is tall.

## The .drawio files

Native, uncompressed `mxGraphModel` documents. They open directly in
[diagrams.net](https://app.diagrams.net) (or the VS Code *Draw.io Integration*
extension) with every shape, connector and label individually selectable and
editable — they are not embedded images.

They were generated from the rendered PlantUML SVG, so positions, labels and
relationships match the committed SVG/PNG. Structure is preserved rather than
flattened:

- **Use case** — the system boundary is a container holding the seven packages,
  and each package contains its own use cases, so moving a package moves its
  contents. Actors use the `umlActor` shape.
- **Activity** — the four lanes are real swimlane containers holding their own
  actions; each control flow keeps its original orthogonal waypoints.
- **Class** — each class is a UML class shape whose title, compartment
  separators and individual attribute rows are separate editable children.

Two deliberate substitutions, both to keep the drawio file looking like the
PlantUML render rather than to redesign anything:

- Decision nodes are drawn as **hexagons**, which is how PlantUML renders a
  labelled condition. The two unlabelled merge nodes are diamonds. Change the
  hexagons to `rhombus` in diagrams.net if strict UML diamond notation is wanted.
- Associations use an open arrowhead (standard UML directed association) where
  PlantUML draws a filled one.

**The `.puml` files remain the source of truth.** If a diagram changes, edit the
PlantUML, re-render, and regenerate the `.drawio` — do not hand-edit the two in
parallel.

## Ground rules followed

- Every actor maps to a value of `foodlink.models.UserRole`, or to an
  unauthenticated caller.
- Every use case maps to an implemented route in `code/foodlink/routers/`.
- The activity flow is a traversal of `models.ALLOWED_TRANSITIONS` gated by
  `routers/donations.TRANSITION_ROLES`.
- Class names, attributes, nullability and cascades come from
  `code/foodlink/models.py`.
- Capabilities that exist in the API but not yet in the web portal are drawn and
  **labelled as such** — see `FoodLink-UML.md` § 8.
- Nothing planned or backlogged appears in any diagram.

## Re-rendering after an edit

Rendered with PlantUML 1.2025.4 on OpenJDK 21.

```bash
java -jar plantuml.jar -tsvg docs/uml/diagrams/*.puml
```

`-tpng` for PNG, `-tpdf` for PDF, `-checkonly` to validate a source without
producing an image. Alternatively use the VS Code *PlantUML* extension (`Alt+D` to
preview). Full instructions: `FoodLink-UML.md` § 9.
