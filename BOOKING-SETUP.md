# Reserva directa — preparación, todavía desactivada

## Comportamiento preparado

- Relájate: 120 EUR/noche, hasta 4 huéspedes. Downtown: 60 EUR/noche, hasta 2.
- 3 a 90 noches. Señal del 20 %, resto del 80 % al llegar.
- Precios calculados por el servidor, nunca aceptados desde el navegador.
- Se comprueban ambos calendarios externos; un fallo impide iniciar un pago.
- PostgreSQL rechaza reservas directas que se solapan, incluso con dos solicitudes simultáneas. La salida no bloquea la noche siguiente.
- Stripe Checkout cobra la señal en euros y tiene 30 minutos de plazo.
- Solo una notificación firmada de Stripe confirma la reserva. Repetirla no duplica la confirmación.
- Las fechas solo se liberan al recibir una expiración de Stripe; no por el reloj del navegador. Un fallo ambiguo al crear la sesión conserva el bloqueo para revisar, evitando liberar una sesión que aún pudiera cobrarse.
- Página de estado con enlace privado y calendario iCal sin datos del huésped.

## Servicios pendientes de configurar

1. Crear una base PostgreSQL en Vercel Storage (Neon) y conectarla al proyecto. Ejecutar `database/001-bookings.sql` una sola vez. No poner DATABASE_URL en el navegador ni en GitHub.
2. Confirmar que STRIPE_SECRET_KEY está presente mediante la integración existente.
3. Crear el endpoint Stripe `https://relajatecorralejo.com/api/stripe-webhook` para `checkout.session.completed` y `checkout.session.expired`. Guardar su firma como STRIPE_WEBHOOK_SECRET en Vercel, sin compartirla en el chat.
4. Crear CALENDAR_EXPORT_TOKEN aleatorio (32 bytes o más). Importar en Booking y Airbnb, para cada apartamento, `https://relajatecorralejo.com/api/calendar?apartment=relajate&token=...` y la variante `apartment=downtown`.
5. **iCal no es una conexión en tiempo real.** Importar las URLs no elimina el riesgo de una venta simultánea externa entre actualizaciones. Antes de aceptar cobros con confirmación inmediata, resolverlo con una conexión de inventario en tiempo real o con confirmación manual previa al cobro. El código preparado no implementa esa confirmación manual todavía. Mantener BOOKING_CHANNELS_READY sin activar hasta resolverlo.
6. Probar en un proyecto/entorno separado con claves de pruebas, base de datos de pruebas e iCal ficticios. La API de Checkout exige el origen oficial; para una prueba integrada hay que parametrizar un origen de pruebas explícito antes de probar en preview.
7. Ejecutar la prueba de concurrencia con TEST_DATABASE_URL de una base aislada con la migración aplicada. Revisar firma inválida, doble notificación, retorno antes del webhook, fechas ocupadas, abandonos, doble clic y errores de red. No realizar cobros reales como prueba.
8. Actualizar los textos de las páginas para indicar la confirmación de pago y condiciones de cancelación. Los textos de solicitud manual actuales deben cambiar cuando se habilite la reserva online.
9. Completar control de abuso/rate limiting y reconciliación operativa de bloqueos sin session_id antes de la activación.
10. Solo tras completar estos pasos activar BOOKING_ENABLED=true y BOOKING_CHANNELS_READY=true en producción y desplegar.

## Validación actual

Las pruebas unitarias verifican precios, límites, calendarios incompletos, importe/moneda/sesión, notificaciones repetidas y expiración. La firma se prueba con el SDK real. La prueba PostgreSQL se omite sin TEST_DATABASE_URL y no equivale a haber probado la concurrencia real. No hay una prueba end-to-end con Stripe ni una base provisionada todavía.

## Configuración y operación

La base conserva identificador, fechas, importes, estado y session_id. Los datos de pago y correo se recogen en Stripe, no en una tabla pública. No se almacenan tarjetas. Consultar cada reserva en Stripe usando client_reference_id / metadata.booking_id. La página de confirmación no sustituye al webhook.

Para un error ambiguo al crear Checkout: localizar primero las sesiones Stripe por metadata.booking_id. Si existe sesión, recuperar su id en la tabla y esperar pago/expiración firmada. Nunca liberar una reserva solo porque pasó media hora. Si se demuestra que no existe sesión, marcarla expired administrativamente. Falta automatizar esta reconciliación.
