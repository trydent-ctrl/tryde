const express = require('express');
const router = express.Router();

module.exports = (pool) => {

  // Middleware para verificar si el usuario está autenticado
  const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
      next();
    } else {
      res.redirect('/login');
    }
  };

  // Ruta para el index (página principal)
  router.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
  });

  // Ruta de login
  router.get('/login', (req, res) => {
    res.render('login');
  });

  // Autenticación de usuarios
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.session.user = {
          id: user.id,
          rol: user.rol
        };
        res.redirect(`/`);
      } else {
        res.send('Email o contraseña incorrectos');
      }
    } catch (error) {
      console.error('Error al autenticar usuario:', error);
      res.status(500).send('Error en el servidor');
    }
  });

  // Ruta para ver y gestionar leads
  router.get('/leads/:id_usuario', isAuthenticated, async (req, res) => {
    const { id_usuario } = req.params;
    try {
      const leads = await pool.query('SELECT * FROM leads WHERE id_usuario = $1', [id_usuario]);
      const userResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id_usuario]);
      const user = userResult.rows[0];
      const vendedores = await pool.query('SELECT id, nombre FROM usuarios WHERE rol = \'vendedor\'');
      res.render('leads', { leads: leads.rows, id_usuario, user, vendedores: vendedores.rows });
    } catch (error) {
      console.error('Error al obtener leads:', error);
      res.status(500).send('Error en el servidor');
    }
  });

  router.get('/dashboard', async (req, res) => {
    const { rows } = await pool.query(`
      SELECT estado, COUNT(*) AS total 
      FROM leads 
      GROUP BY estado
    `);
    res.render('dashboard', { data: rows });
  });
  
  // Ruta para crear un nuevo lead
  router.post('/leads', isAuthenticated, async (req, res) => {
    const { nombre, email, telefono, estado, id_usuario, asignar_a } = req.body;
    try {
      const userResult = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [id_usuario]);
      const user = userResult.rows[0];

      let idAsignado;
      if (user.rol === 'admin' || user.rol === 'admin1') {
        idAsignado = asignar_a;
      } else {
        idAsignado = id_usuario;
      }

      await pool.query('INSERT INTO leads (nombre, email, telefono, estado, id_usuario) VALUES ($1, $2, $3, $4, $5)', 
                       [nombre, email, telefono, estado, idAsignado]);

      res.redirect(`/leads/${id_usuario}`);
    } catch (error) {
      console.error('Error al crear lead:', error);
      res.status(500).send('Error en el servidor');
    }
  });

  // Ruta para actualizar el estado y agregar nota a un lead
router.post('/leads/update/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { nuevo_estado, nota } = req.body;
    try {
      await pool.query('UPDATE leads SET estado = $1, nota = $2 WHERE id = $3', [nuevo_estado, nota, id]);
      res.redirect(`/leads/${req.session.user.id}`);
    } catch (error) {
      console.error('Error al actualizar el lead:', error);
      res.status(500).send('Error en el servidor');
    }
  });
  

  // Ruta para eliminar un lead
  router.post('/leads/delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { id_usuario } = req.body;
    try {
      await pool.query('DELETE FROM leads WHERE id = $1', [id]);
      res.redirect(`/leads/${id_usuario}`);
    } catch (error) {
      console.error('Error al eliminar lead:', error);
      res.status(500).send('Error en el servidor');
    }
  });

  // Ruta para ver gráficos
  router.get('/chart', isAuthenticated, async (req, res) => {
    try {
      const leadsPorEstado = await pool.query("SELECT estado, COUNT(*) as total FROM leads GROUP BY estado");
      const data = leadsPorEstado.rows;
      res.render('chart', { data });
    } catch (error) {
      console.error('Error al obtener datos para el gráfico:', error);
      res.status(500).send('Error en el servidor');
    }
  });

  // Cerrar sesión
  router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  return router;
};



// Ruta para mostrar todos los leads (solo para admin)
router.get('/leads', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leads');
  res.render('leads', { leads: rows, user: req.session.user });
});

// Ruta para actualizar el estado de un lead
router.post('/leads/update/:id', async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, nota } = req.body;
  await pool.query('UPDATE leads SET estado = $1, nota = $2 WHERE id = $3', [nuevo_estado, nota, id]);
  res.redirect('/leads');
});

// Ruta para descargar los leads en formato Excel
router.get('/leads/download', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leads');
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');
  
  worksheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Teléfono', key: 'telefono', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Nota', key: 'nota', width: 30 },
  ];

  worksheet.addRows(rows);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.xlsx');
  
  workbook.xlsx.write(res).then(() => res.end());
});
