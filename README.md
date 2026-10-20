# Station

Browser app for a tablet at a packing bench. One task on screen at a time: Today, Now, How, Check, Done, Next.

The first visit loads three sample tasks for today. Staff can replace all of it. Nothing about a real workplace is fixed in the code.

Demo PIN: `2468`. Change it in Staff before a tablet is used.

Tasks, photos, and the PIN stay in this browser (IndexedDB). There is no server database. After the page has loaded once, the service worker keeps the app available offline.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5190

Vercel: Vite preset, build `npm run build`, output `dist`.
