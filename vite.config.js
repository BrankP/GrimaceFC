import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
function resolveBase() {
    var _a, _b;
    var repo = (_b = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/')[1]) !== null && _b !== void 0 ? _b : '';
    if (!repo)
        return '/';
    if (repo.toLowerCase().endsWith('.github.io'))
        return '/';
    return "/".concat(repo, "/");
}
export default defineConfig({
    plugins: [react()],
    base: resolveBase(),
});
