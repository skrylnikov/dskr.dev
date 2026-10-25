import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('.state/travel-dist');
const mediaRoot = process.env.TRAVEL_MEDIA_ROOT && resolve(process.env.TRAVEL_MEDIA_ROOT);
const portraitHash = createHash('sha256').update('2').digest('hex');
const videoHash = createHash('sha256').update('4').digest('hex');
const portraitVideoHash = createHash('sha256').update('199').digest('hex');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp', '.jxl': 'image/jxl' };
createServer(async (request, response) => {
	try {
		const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
		let file;
		if (path.startsWith('/media/')) {
			if (mediaRoot) { file = resolve(mediaRoot, path.slice('/media/'.length)); if (!file.startsWith(mediaRoot + sep)) throw new Error('Outside media root'); }
			else file = path.endsWith('.mp4') ? resolve(`.state/travel-fixtures/${path.includes(portraitVideoHash) ? 'portrait-clip' : 'clip'}.mp4`) : resolve(`.state/travel-fixtures/${path.includes(portraitVideoHash) ? 'video-portrait' : path.includes(videoHash) ? 'video-landscape' : path.includes(portraitHash) ? 'portrait' : 'landscape'}${extname(path)}`);
		}
		else {
			file = resolve(root, `.${path}`);
			if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside root');
			if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
		}
		const body = await readFile(file);
		response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
		response.setHeader('Accept-Ranges', 'bytes');
		const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
		if (range) {
			const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
			if (start > end) { response.writeHead(416); response.end(); return; }
			response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 }); response.end(body.subarray(start, end + 1));
		} else { response.writeHead(200, { 'Content-Length': body.length }); response.end(body); }
	} catch { response.writeHead(404); response.end('Not found'); }
}).listen(4399, '127.0.0.1');
