'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '../.env')
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 

const processRoutes =
  require('./routes/process.routes');

const app = express();
const {
  initializeSchema
} = require('./database/init-db');
const PORT =
  parseInt(
    process.env.PORT || '3000',
    10
  );


/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://dataprotectionsystem.netlify.app'
    ],

    methods: [
      'GET',
      'POST',
      'OPTIONS'
    ]
  })
);


/* =========================================================
   SECURITY MIDDLEWARE
========================================================= */

/*
  Prevent caching of sensitive API responses
*/

app.use(
  '/api',
  (req, res, next) => {

    res.set(
      'Cache-Control',
      'no-store'
    );

    next();
  }
);


/*
  Basic security headers
*/

app.use(
  (req, res, next) => {

    res.set(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.set(
      'X-Frame-Options',
      'SAMEORIGIN'
    );

    res.set(
      'X-XSS-Protection',
      '1; mode=block'
    );

    res.set(
      'Referrer-Policy',
      'no-referrer'
    );

    next();
  }
);


/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb'
  })
);


/* =========================================================
   STATIC FRONTEND
========================================================= */

/* =========================================================
   API ROUTES
========================================================= */

app.use(
  '/api',
  processRoutes
);


/* =========================================================
   STATIC FRONTEND
========================================================= */

const FRONTEND_DIR =
  path.join(
    __dirname,
    '../frontend/public'
  );


app.use(
  express.static(
    FRONTEND_DIR,
    {
      index: 'index.html',
      etag: true
    }
  )
);


/* =========================================================
   SPA FALLBACK
========================================================= */

app.get(
  '*',
  (req, res) => {

    const indexPath =
      path.join(
        FRONTEND_DIR,
        'index.html'
      );


    if (
      fs.existsSync(
        indexPath
      )
    ) {

      res.sendFile(
        indexPath
      );

    } else {

      res
        .status(404)
        .json({
          error:
            'Not found'
        });

    }
  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    /*
      Never log:
      - file contents
      - passwords
      - encryption keys
    */

    console.error(
      '[UDPS Error]',
      err.message
    );


    const status =
      err.status ||
      err.statusCode ||
      500;


    res
      .status(status)
      .json({
        success: false,

        error:
          err.message ||
          'Internal server error'
      });
  }
);


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  try {

    await initializeSchema();

  } catch (err) {

    console.error(
      '[DB Init Warning]',
      err.message
    );

    /*
      Database history should not prevent
      UDPS file-processing functionality
      from starting.
    */

  }


  app.listen(
    PORT,
    '0.0.0.0',
    () => {

      console.log(
        `[UDPS] Server running on port ${PORT}`
      );

      console.log(
        `[UDPS] Frontend: ${FRONTEND_DIR}`
      );

    }
  );
}


startServer();

module.exports = app;