# Scraper de Estado RUT

Este proyecto es una herramienta de scraping que consulta el estado del RUT (Registro Único Tributario) en la página oficial de la DIAN (Dirección de Impuestos y Aduanas Nacionales) de Colombia. Utiliza Bun.js como entorno de ejecución y varias librerías para realizar el scraping y procesamiento de datos.

## Características

- Consulta individual del estado del RUT.
- Procesamiento por lotes de números de identificación desde un archivo Excel.
- Uso de Puppeteer con un plugin stealth para evitar la detección.
- Endpoints RESTful para consultas individuales y procesamiento de archivos.

## Tecnologías Utilizadas

- [Bun.js](https://bun.sh/): Un entorno de ejecución rápido para JavaScript.
- [Express](https://expressjs.com/): Framework para manejar las solicitudes HTTP.
- [Puppeteer](https://pptr.dev/): Librería para controlar un navegador headless.
- [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth): Plugin para Puppeteer para evitar la detección.
- [Multer](https://github.com/expressjs/multer): Middleware para manejar la subida de archivos.
- [xlsx](https://www.npmjs.com/package/xlsx): Librería para manejar archivos Excel.

## Instalación

1. Clona este repositorio en tu máquina local.
2. Asegúrate de tener instalado [Bun.js](https://bun.sh/).
3. Instala las dependencias del proyecto:

```bash
bun install
