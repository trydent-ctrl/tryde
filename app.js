require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const routes = require('./routes');
const app = express();

app.use(express.static('public'));
// Configurar la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verificar la conexión a la base de datos
pool.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
  } else {
    console.log('Conectado a la base de datos');
  }
});

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Para archivos estáticos

// Configuración de la sesión
app.use(session({
  secret: 'mi_secreto',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');

// Rutas
app.use('/', routes(pool));

// Middleware para manejar 404
app.use((req, res) => {
  res.status(404).send('Página no encontrada');
});

// Escuchar en el puerto definido
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
