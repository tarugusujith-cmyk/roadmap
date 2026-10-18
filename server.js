// JSON Server (mock backend). Used locally (`npm run api`) and can be hosted on Render/Railway/etc.
import jsonServer from 'json-server';

const PORT = process.env.PORT || 3001;
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults({ noCors: false });

server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use(router);
server.listen(PORT, () => {
  console.log(`ProductPulse API (JSON Server) running on http://localhost:${PORT}`);
});
