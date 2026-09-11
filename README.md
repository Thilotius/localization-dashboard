# Localization Dashboard

Static React/Vite dashboard for exploring historical Lokalise project snapshots from `public/snapshots/`.

## Weekly Lokalise snapshot automation

- A scheduled GitHub Actions workflow at `.github/workflows/update-snapshot.yml` refreshes the snapshot every **Monday at 06:00 UTC** and also supports **manual `workflow_dispatch` runs** from the Actions tab.
- Configure the repository Actions secret **`LOKALISE_API_TOKEN`** once before using the workflow. The token is read from the environment only, must stay read-only, and must never be committed.
- To run the same flow locally:

  ```bash
  LOKALISE_API_TOKEN=your-read-only-token npm run snapshot
  npm run scrub
  npm run lint
  npm run build
  ```

- `npm run snapshot` writes `public/snapshots/YYYY-MM-DD_Lokalise_projects.json`, redacts `created_by_email`, `created_by`, and `description` before writing, and refuses to overwrite an existing snapshot for the same UTC date unless `node scripts/fetch-snapshot.mjs --overwrite` is used intentionally.
- If the token is missing, the Lokalise API fails, or the response is malformed, the script exits with a clear error and does not write a partial snapshot.

See `/home/runner/work/localization-dashboard/localization-dashboard/SNAPSHOT_PROCESS.md` for the full operational guide.

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
