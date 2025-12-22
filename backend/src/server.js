'use strict';

const app = require('./app');

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`[abonasi-backend] listening on http://localhost:${PORT}`);
});
