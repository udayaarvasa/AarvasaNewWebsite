# REEF collection release — 8 November 2026

The project owner approved the local map/model preview and requested launch in the same working session. This release publishes all five reviewed exterior reconstructions, 54 additional developer renders, and sourced project specifications. The blockchain prototype, database schema and runtime infrastructure are outside this release.

## Approved model objects

| Project | SHA-256 | Production object | Size | Ground offset (metres) |
| --- | --- | --- | ---: | ---: |
| reef-996-dubai-production-city | `9ea83ecf6f4a8504ac6240666581199c48c0f0866c51c59ffc76cf40c4042a7c` | `m/076958045057e7a9c10ce030/9ea83ecf6f4a8504/scene.glb` | 3818552 | 43.97 |
| reef-997-dubai-islands | `3ec2651523f35f1b45e1f80fa52e1dae5b7b1fa4bb0d037c5e8030fef70fc482` | `m/b74adf3d8270870532521859/3ec2651523f35f1b/scene.glb` | 2560520 | 22.65 |
| reef-998-dlrc | `589b15693f0a2ef6db8a416dea3a2043b13a30860cc62649f091cd9a219ace20` | `m/0448dc15c26a47c585c33d51/589b15693f0a2ef6/scene.glb` | 1135668 | 44.25 |
| reef-999-al-furjan | `a48114b0af093eebe6c517ec617682f1224d085b7bc409670f2383c5e5b6bbc9` | `m/5554de246184e0e201e0d656/a48114b0af093eeb/scene.glb` | 3925896 | 24.775 |
| reef-1000-dlrc | `aeb69aa08baf1b75a3bcff465d1e1d8af636e393f74d6043dafffcb946db9ffc` | `m/0617a25823e5bdbc902303eb/aeb69aa08baf1b75/scene.glb` | 702964 | 16.425 |

The GLBs use the existing production model CDN. All are labelled Aarvasa reconstructions, with approximate geographic placement. Ground offsets were checked against the actual centred GLB bounds at the existing map scale of 10. Existing project coordinates and their locality-precision source notes are retained.

## Sources and limitations

Facts and imagery were checked against the developer project pages on 8 November 2026:
- [REEF 996](https://reefdevelopments.ae/projects/reef-996)
- [REEF 997](https://reefdevelopments.ae/projects/reef-997)
- [REEF 998](https://reefdevelopments.ae/projects/reef-998)
- [REEF 999](https://reefdevelopments.ae/projects/reef-999)
- [REEF 1000](https://reefdevelopments.ae/projects/reef-1000)

`reef-release-sources-2026-11-08.json` records each downloaded image source, retrieval date and original checksum. The existing image-permission record in `media-rights.md` covers these five projects. All new images are labelled developer renders; complete frames were retained at web resolution.

Current project-wide residence counts, completion quarters, residence sizes and amenities appear in a separate developer reference section. The older released-unit inventory remains dated and is not represented as refreshed pricing or availability.

996 and 997 reuse the existing reconstruction generators; 998 retains the reviewed v3 geometry; 999 uses the new `tools/reef-999-massing.py`; 1000 uses the existing U-shaped mid-rise generator. These are exterior visual approximations, not developer CAD/BIM or surveys. Level counts for 999/1000, hidden elevations, footprint dimensions and storey heights include estimates. 997 wing articulation is simplified.

## Release process

Build from the current production branch using the existing `aarvasa-web-image` CodeBuild project, tag the image with the release commit, and roll only the existing ECS service to the new image. Preserve all task secrets, roles, networking and database settings. The prior ECS task-definition revision is the rollback target. No database migration is needed.

Verify HTTPS model checksums and CORS, property pages, photo assets, `/api/properties`, and the 3D map overlay before considering the release complete.
