/* Validación del formulario de contacto + estimación del tiempo de respuesta.
   Algoritmo documentado en docs/tiempo-respuesta.fprg (Flowgorithm). */
(function () {
  'use strict';

  var form = document.getElementById('form-contacto');
  var resumen = document.getElementById('resumen');
  var errorGeneral = document.getElementById('error-general');
  var mensaje = document.getElementById('mensaje');
  var contador = document.getElementById('contador');
  var MIN_MENSAJE = 20;

  // La fecha de nacimiento no puede ser futura
  var hoy = new Date();
  document.getElementById('nacimiento').max =
    hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');

  // Enlace a la intranet según el dominio actual
  var link = document.querySelector('[data-intranet]');
  if (link && location.hostname.indexOf('www.') === 0) {
    link.href = location.protocol + '//intranet.' + location.hostname.slice(4) + (location.port ? ':' + location.port : '');
  }

  mensaje.addEventListener('input', function () {
    contador.textContent = mensaje.value.trim().length;
  });

  /* ---------- Validadores: devuelven '' si es correcto, o el mensaje de error ---------- */
  var validadores = {
    nombre: function (v) {
      v = v.trim();
      if (!v) return 'El nombre es obligatorio.';
      if (v.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
      return '';
    },
    apellidos: function (v) {
      v = v.trim();
      if (!v) return 'Los apellidos son obligatorios.';
      if (v.length < 3 || v.length > 40) return 'Los apellidos deben tener entre 3 y 40 caracteres.';
      return '';
    },
    edad: function (v) {
      if (v.trim() === '') return 'La edad es obligatoria.';
      var n = Number(v);
      if (!Number.isInteger(n) || n < 16 || n > 65) return 'La edad debe ser un número entero entre 16 y 65.';
      return '';
    },
    nacimiento: function (v) {
      if (!v) return 'La fecha de nacimiento es obligatoria.';
      if (new Date(v) > new Date()) return 'La fecha de nacimiento no puede ser futura.';
      return '';
    },
    telefono: function (v) {
      v = v.replace(/\s/g, '');
      if (!v) return 'El teléfono es obligatorio.';
      if (!/^\d{9}$/.test(v)) return 'El teléfono debe tener exactamente 9 dígitos.';
      return '';
    },
    cp: function (v) {
      v = v.trim();
      if (!v) return 'El código postal es obligatorio.';
      if (!/^\d{5}$/.test(v)) return 'El código postal debe tener exactamente 5 dígitos.';
      return '';
    },
    email: function (v) {
      v = v.trim();
      if (!v) return 'El correo electrónico es obligatorio.';
      var arroba = v.indexOf('@');
      if (arroba < 1 || v.indexOf('@', arroba + 1) !== -1) return 'El correo debe contener un único símbolo @ con texto delante.';
      var punto = v.indexOf('.', arroba);
      if (punto === -1 || punto === arroba + 1 || punto === v.length - 1) return 'El correo debe contener un punto (.) después de la @, por ejemplo nombre@empresa.com.';
      return '';
    },
    tipo: function () {
      var marcados = form.querySelectorAll('input[name="tipo"]:checked');
      if (marcados.length !== 1) return 'Selecciona un tipo de mensaje: duda, sugerencia, queja u otros.';
      return '';
    },
    mensaje: function (v) {
      var n = v.trim().length;
      if (n === 0) return 'El mensaje es obligatorio.';
      if (n < MIN_MENSAJE) return 'El mensaje debe tener al menos ' + MIN_MENSAJE + ' caracteres (llevas ' + n + ').';
      return '';
    },
    archivos: function () {
      var files = document.getElementById('archivos').files;
      for (var i = 0; i < files.length; i++) {
        if (!/\.(pdf|docx?)$/i.test(files[i].name)) return '«' + files[i].name + '» no es un PDF ni un documento Word.';
      }
      return '';
    },
    privacidad: function () {
      return document.getElementById('privacidad').checked ? '' : 'Debes aceptar las condiciones de Protección de datos para enviar el formulario.';
    }
  };

  // Orden en que aparecen en el formulario (para enfocar el primer error)
  var orden = ['nombre', 'apellidos', 'edad', 'nacimiento', 'telefono', 'cp', 'email', 'tipo', 'mensaje', 'archivos', 'privacidad'];

  function valorDe(campo) {
    var el = document.getElementById(campo);
    return el ? el.value : '';
  }

  function mostrarError(campo, texto) {
    var p = document.getElementById('err-' + campo);
    p.textContent = texto;
    var el = document.getElementById(campo);
    if (el) {
      if (texto) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'err-' + campo); }
      else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
    }
    if (campo === 'tipo') {
      form.querySelectorAll('input[name="tipo"]').forEach(function (r) {
        if (texto) r.setAttribute('aria-invalid', 'true'); else r.removeAttribute('aria-invalid');
      });
    }
  }

  function validarCampo(campo) {
    var msg = validadores[campo](valorDe(campo));
    mostrarError(campo, msg);
    return msg;
  }

  function validarTodo() {
    var errores = [];
    orden.forEach(function (campo) {
      var msg = validarCampo(campo);
      if (msg) errores.push(campo);
    });
    return errores;
  }

  // Revalida al salir de cada campo, una vez que ya se ha intentado enviar
  var intentado = false;
  orden.forEach(function (campo) {
    var el = document.getElementById(campo);
    var evento = (campo === 'tipo') ? 'change' : 'blur';
    var objetivo = el || form.querySelector('input[name="tipo"]');
    if (campo === 'tipo') {
      form.querySelectorAll('input[name="tipo"]').forEach(function (r) {
        r.addEventListener('change', function () { if (intentado) validarCampo('tipo'); });
      });
    } else if (objetivo) {
      objetivo.addEventListener(campo === 'privacidad' || campo === 'archivos' ? 'change' : evento, function () {
        if (intentado) validarCampo(campo);
      });
    }
  });

  /* ---------- Estimación del tiempo de respuesta ---------- */
  var HORAS_BASE = { duda: 24, sugerencia: 72, queja: 12, otros: 48 };

  function calcularRespuesta(tipo, fecha) {
    var base = HORAS_BASE[tipo];
    var dia = fecha.getDay();               // 0 = domingo, 6 = sábado
    var hora = fecha.getHours();
    var extra = 0, motivo = 'Día laborable antes de las 18:00: sin recargo.';
    if (dia === 0 || dia === 6) {
      extra = 12; motivo = 'Solicitud en fin de semana: +12 horas.';
    } else if (hora >= 18) {
      extra = 8; motivo = 'Día laborable a partir de las 18:00: +8 horas.';
    }
    var total = base + extra;
    return { base: base, extra: extra, total: total, motivo: motivo,
             fechaRespuesta: new Date(fecha.getTime() + total * 3600 * 1000) };
  }

  function formatoFecha(d) {
    return d.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- Resumen ---------- */
  function el(tag, texto, clase) {
    var e = document.createElement(tag);
    if (texto !== undefined) e.textContent = texto;
    if (clase) e.className = clase;
    return e;
  }

  function mostrarResumen(fecha) {
    var tipo = form.querySelector('input[name="tipo"]:checked').value;
    var r = calcularRespuesta(tipo, fecha);
    var archivos = Array.prototype.map.call(document.getElementById('archivos').files, function (f) { return f.name; });

    var datos = [
      ['Nombre', valorDe('nombre').trim() + ' ' + valorDe('apellidos').trim()],
      ['Edad', valorDe('edad') + ' años'],
      ['Fecha de nacimiento', new Date(valorDe('nacimiento') + 'T00:00').toLocaleDateString('es-ES')],
      ['Teléfono', valorDe('telefono').replace(/\s/g, '')],
      ['Código postal', valorDe('cp').trim()],
      ['Correo electrónico', valorDe('email').trim()],
      ['Tipo de mensaje', tipo.charAt(0).toUpperCase() + tipo.slice(1)],
      ['Mensaje', valorDe('mensaje').trim()],
      ['Adjuntos', archivos.length ? archivos.join(', ') : 'Ninguno'],
      ['Protección de datos', 'Aceptada']
    ];

    resumen.textContent = '';
    resumen.appendChild(el('h3', 'Revisa los datos antes de enviar'));
    resumen.appendChild(el('p', 'Solicitud registrada el ' + formatoFecha(fecha) + '.'));

    var dl = el('dl');
    datos.forEach(function (par) { dl.appendChild(el('dt', par[0])); dl.appendChild(el('dd', par[1])); });
    resumen.appendChild(dl);

    var eta = el('div', undefined, 'eta');
    var linea = el('p');
    linea.style.margin = '0 0 4px';
    linea.appendChild(document.createTextNode('Tiempo de respuesta estimado: '));
    linea.appendChild(el('strong', r.total + ' horas'));
    eta.appendChild(linea);
    eta.appendChild(el('p', 'Base para «' + tipo + '»: ' + r.base + ' h. ' + r.motivo, 'hint'));
    eta.appendChild(el('p', 'Respuesta prevista hacia el ' + formatoFecha(r.fechaRespuesta) + '.', 'hint'));
    resumen.appendChild(eta);

    var acciones = el('div', undefined, 'actions');
    var confirmar = el('button', 'Confirmar envío', 'btn');
    confirmar.type = 'button';
    confirmar.addEventListener('click', function () {
      resumen.textContent = '';
      resumen.appendChild(el('h3', 'Mensaje enviado (simulación)'));
      resumen.appendChild(el('p', 'Gracias, ' + valorDe('nombre').trim() + '. Te responderemos en un plazo estimado de ' + r.total + ' horas.'));
      form.reset();
      contador.textContent = '0';
      form.hidden = false;
      resumen.focus();
    });
    var editar = el('button', 'Editar datos', 'btn btn-outline');
    editar.type = 'button';
    editar.addEventListener('click', function () {
      resumen.hidden = true;
      form.hidden = false;
      document.getElementById('nombre').focus();
    });
    acciones.appendChild(confirmar);
    acciones.appendChild(editar);
    resumen.appendChild(acciones);

    form.hidden = true;
    resumen.hidden = false;
    resumen.focus();
    resumen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Envío ---------- */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    intentado = true;
    var errores = validarTodo();

    if (errores.length) {
      errorGeneral.textContent = errores.length === 1
        ? 'Hay 1 error en el formulario. Corrígelo para poder enviarlo.'
        : 'Hay ' + errores.length + ' errores en el formulario. Corrígelos para poder enviarlo.';
      errorGeneral.hidden = false;
      resumen.hidden = true;
      var primero = errores[0] === 'tipo' ? form.querySelector('input[name="tipo"]') : document.getElementById(errores[0]);
      if (primero) primero.focus();
      return;
    }

    errorGeneral.hidden = true;
    intentado = false;
    mostrarResumen(new Date());
  });
})();
