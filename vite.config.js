import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from "@cloudflare/vite-plugin";
function resolveBase(repository) {
    var _a;
    var repo = (_a = repository === null || repository === void 0 ? void 0 : repository.split('/')[1]) !== null && _a !== void 0 ? _a : '';
    if (!repo)
        return '/';
    if (repo.toLowerCase().slice(-10) === '.github.io')
        return '/';
    return "/".concat(repo, "/");
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    return {
        plugins: [react(), cloudflare()],
        base: resolveBase(env.GITHUB_REPOSITORY),
    };
});
