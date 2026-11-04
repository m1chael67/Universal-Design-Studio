# Celina-based West Coast frame profiles — Universal Design Studio

## Scope

The app's **default** roof profile is West Coast. The model now uses Celina's published Classic/ETS frame *geometry*, with real-width frame families rather than scaling a single 20×40 template. A 7-foot nominal leg / eave height is the default, with optional 8–12 ft eaves.

**The 3D viewer is a planning visual, not an engineered structure, anchoring plan, approved method of erection, parts order or fabrication cut list.** Even when nominal spans and diagrams match, the pieces and fitting dimensions used by different manufacturers can vary. Confirm actual Universal Rentals inventory before using any representation for field instructions.

## Primary sources

1. **[Celina Layout Handbook, Fifth Edition](https://celinaeurope.com/wp-content/uploads/2025/06/layout-handbook.pdf)** — Classic Series Frame profiles (pp. 9–30), including width, nominal roof pitch, modular leg grid, crown types, roof/spreader tube sizes and fittings.
2. **[Celina 20×40 Classic Frame Directions](https://www.ecanopy.com/files/Manuals/celinatent20x40framedirections.pdf)** — 20-ft family: four 14 ft 4 in hip rafters, eight 10 ft 6 in rafters, fourteen 9 ft 4 in spreaders, 12 legs, four corners, eight side tees, two 6-way crowns, one ridge crown; 20-ft cable assemblies are also shown in the handbook.
3. **[Celina 30×60 ETS Frame Directions](https://www.ecanopy.com/files/Manuals/celinatent30x60etsframetentinstructions.pdf)** — 30-ft family: 15-ft bays, 8-ft nominal pitch, double-tube rafters, support braces and cable assemblies.
4. **[Celina 40×60 ETS Frame Directions](https://www.ecanopy.com/files/Manuals/celinatent40x60etsframetentinstructions.pdf)** — 40-ft family: 10-ft perimeter bays, 10-ft nominal pitch, quarter hip-joint subassemblies, double-tube rafters, ridge crowns and braces.
5. **[Celina 40×80 ETS Frame Directions](https://www.ecanopy.com/files/Manuals/celinatent40x80etsframetentinstructions.pdf)** — 40-ft frame continuation: four hip joints, three intermediate ridge crowns between two end crowns and 24 perimeter legs.
6. **[Celina installation-manual library](https://gettentcom-sandbox.mybigcommerce.com/installation-manuals/)** — size-by-size Classic Frame and Master Frame manuals. Celina *Master Series*, *Hybrid Frame*, *Classic* and *ETS* must not be treated as a single interchangeable physical inventory line.

## Current profile data

| Nominal width | Nominal roof rise above eave | Frame bays and details |
| --- | ---: | --- |
| 10 ft | 2 ft 6 in | Classic family; 10-ft bay grid |
| 15 ft | 3 ft 9 in | Classic family; nominal 15-ft, with mixed 10/15-ft configurations for some lengths |
| 20 ft | 5 ft | Classic family; 10-ft bays and intermediate end-wall supports |
| 30 ft | 8 ft | Classic/ETS family; 15-ft bays, sometimes mixed 10/15-ft, double-tube roof members and braces |
| 40 ft | 10 ft | ETS family; 10-ft grid, multiple end supports, quarter hip-joints, double-tube members and braces |

Specific rendered checks:
- **20×40:** 4 × 10-ft length bays; 12 legs; 2 end 6-way crowns + 1 intermediate ridge crown; 5-ft pitch above eave.
- **30×40:** mixed 15/10/15 length bays; 10 legs; 2 end 6-way crowns; 8-ft pitch.
- **30×60:** 4 × 15-ft bays; 12 legs; 2 end crowns + 1 ridge crown; 8-ft pitch.
- **40×80:** 8 × 10-ft bays; 24 legs; 2 end crowns + 3 intermediate ridge crowns; 4 quarter-hip joints; 10-ft pitch.
- Nonstandard width/length selections explicitly show **approximate frame** in the viewer. They are not labeled as verified Celina configurations.

Member positioning and roof heights are nominal **feet** in one coordinate system. Published Celina pipe stock lengths (for example a 9 ft 4 in spreader for a nominal 10-ft span) differ because fittings consume tube length. These nominal dimensions are intentionally **not** used as cut lengths or parts quantities.

## Preview controls

- **Frame-only view** toggles canopy off with the structural members still visible. The roof selector also supports solid, transparent and hidden canopy.
- **Show dimensions** adds length, width, nominal leg/eave and ridge height, plus stage deck height labels. Measurements appear in the screenshot export when visible.
- West Coast bay spacing is **automatic** from the Celina frame family. The manual bay-size selector remains available only for the alternative conceptual gable/flat roofs.
- **Stairs:** 2D yellow TOP / STAGE edge must be aligned outside and close to a stage edge. Matching is based on footprint geometry (not hidden stored IDs), so the 3D stair rise updates automatically whenever its attached stage height is edited, or becomes standalone again when detached.
- **Stage:** black 4×4 modular sections, 16-inch default deck height, editable in the interior planner.

### Remaining limitations

The 30- and 40-foot frame braces/cables are represented schematically, not engineered geometry. The 3D frame excludes detailed fitting sockets, fabric tension, stakes and anchors, all of which require manufacturer specifications and site-specific engineering. It also cannot infer which manufacturer stock pieces Universal Rentals owns. Verify the inventory when deriving crew assembly information.
