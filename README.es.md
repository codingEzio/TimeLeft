# TimeLeft

<p><img src="docs/icon.svg" width="96" height="96" alt="TimeLeft"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) ·
[繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md)
· [Español](README.es.md)

Un instrumento web local e independiente para ver el tiempo restante o
transcurrido en diez rangos anidados, desde una vida elegida hasta el segundo
actual. No necesita cuenta ni servicio remoto y no incluye fechas personales por
defecto.

## Vista de ejemplo

![TimeLeft — Demo person](docs/demo/timeleft-en.png)

Captura real con datos ficticios: Demo person, fecha de nacimiento 2000-01-01 y
una vida objetivo de 80 años. El tiempo mostrado cambia con el reloj. La
interfaz de esta captura está en inglés.

## Vista

Define nombre, nacimiento y vida objetivo. Las fechas parciales o estimadas
siguen marcadas como aproximadas. Cambia Contours/Digits, Remaining/Elapsed y
las unidades directamente. La interfaz ofrece inglés, chino tradicional y
simplificado, temas y System/Pixel; traducir este README no añade idiomas a la
interfaz.

## Guardar e importar

Los datos pertenecen a este navegador y origen. Exporta un backup antes de
borrar datos o cambiar de dirección o dispositivo. Previsualiza una exportación
Prometheus con `family.lifeCountdown`, `time.display`, `time.preferences` o
`time.lifeProfile` antes de aplicarla. Los IDs existentes no se sobrescriben y
los ajustes heredados quedan en el backup. Un backup TimeLeft reemplaza los
datos locales tras confirmación. Límites: 1.000 personas y 5 MB por archivo. No
cambia los archivos originales ni los datos de Prometheus. Tras una visita
online, los orígenes compatibles con service workers permiten recargar y editar
sin conexión; la interfaz indica su disponibilidad.

## Ejecutar y límites

Requiere Deno con `deno bundle`. Ejecuta `deno task build` y después
`deno task preview`, que imprime una URL loopback. `deno task check` verifica
modelo, idiomas y calendario. Un build no prueba guardado real, dispositivo,
instalación ni todos los entornos de horario de verano. Esta revisión no importa
datos personales, elimina fuentes ni opera servicios.

El build también incluye la licencia del proyecto sin cambios en
`dist/LICENSE.txt` y todos los avisos y la procedencia de las fuentes existentes
en `dist/font-notices.txt`.

## Fuente y derechos

El código usa GPL-3.0-only. Adapta código escrito por codingEzio y modifica
el calendario y la presentación para TimeLeft. No añade arte externo,
servicio runtime ni CDN. DeparturePixelZh Compact opcional conserva OFL 1.1 y
sus notices. Publicar una compilación o alojar la aplicación son decisiones separadas.

Font preparation / 字型準備 / 字体准备: see [README](README.md#font-preparation).
