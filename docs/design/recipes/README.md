# Recipe interface design

[Feature specification](../../recipes-spec.md)

| Reference | Intended use |
| --- | --- |
| [Catalogue](catalogue.png) | Live search, compact ingredient filters and recipe cards. |
| [Recipe detail](detail.png) | Reading and managing ingredients and preparation steps. |
| [Editor dialogs](editor-dialogs.png) | Recipe creation, editing and deletion, ingredient selection and quantity editing, step creation. |
| [Step and removal dialogs](step-and-removal-dialogs.png) | Step editing and deletion, ingredient removal confirmation. |
| [Recipe placeholder](../../../src/assets/recipe-placeholder.png) | Reusable asset for recipe cards and details. Use an empty alt attribute next to an already visible recipe title. |

The catalogue and detail mockups are the current layout references. Use the dialog boards for form structure and the specification for exact behavior. Example dishes, photos and text are illustrative. The API supplies recipe names and descriptions. The initial implementation uses the same placeholder for every recipe.

## Palette and components

| Role | Value | Application |
| --- | --- | --- |
| Warm cream | `#F6F1E8` | Page and dialog backgrounds. |
| Olive | `#46523D` | Body text, headings, icons and default control outlines. |
| Terracotta | `#B84C24` | Primary buttons, active accents and step numbers. Use white text on filled primary buttons. |

Define the three colors once as CSS custom properties. Derive quiet borders, hover backgrounds and focus states from the palette. Use a serif for editorial headings and a system sans-serif for controls. Keep labels visible for creation and additions. Use consistent outline icons for editing, moving, removing and deleting. An icon can be small while its hit area remains at least 44 × 44 CSS pixels. Give every icon button a contextual accessible name, visible focus and an accessible tooltip on hover and keyboard focus. Confirm destructive actions in a dialog.

On small screens, wrap the filter row and place ingredients above preparation. Put row actions on a second line if this makes the content easier to read.
