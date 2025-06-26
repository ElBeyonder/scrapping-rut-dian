
    const express = require('express');
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const xlsx = require('xlsx');
    const fs = require('fs');
    const path = require('path');
    const multer = require('multer');
    const cors = require('cors');

    // Configuración inicial
    const app = express();
    const PORT = 3000;

    // Middlewares
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use('/results', express.static(path.join(__dirname, 'results')));

    // Configuración de Multer para subir archivos
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = './uploads';
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        }
    });
    const upload = multer({ storage });

    // Aplicar plugin Stealth
    puppeteer.use(StealthPlugin());

    // Configuración de Puppeteer
    const PUPPETEER_OPTIONS = {
        headless: "new", // Usar el nuevo motor headless
        args: [
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
            '--disable-setuid-sandbox'
        ],
        timeout: 60000
    };

    // Función mejorada para hacer scraping del estado del RUT
    async function check_RUT(cedula) {
        let browser;
        try {
            browser = await puppeteer.launch(PUPPETEER_OPTIONS);
            const page = await browser.newPage();

            // Configuración de la página
            await page.setDefaultNavigationTimeout(60000);
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/',
            });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            // Navegación a la página
            await page.goto('https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Esperar y completar el campo NIT
            await page.waitForSelector("input[name='vistaConsultaEstadoRUT:formConsultaEstadoRUT:numNit']", { timeout: 30000 });
            await page.type("input[name='vistaConsultaEstadoRUT:formConsultaEstadoRUT:numNit']", cedula);

            // Intentar hacer clic en el botón de búsqueda
            try {
                await page.click("input[name='vistaConsultaEstadoRUT:formConsultaEstadoRUT:btnBuscar']", { timeout: 10000 });
            } catch (error) {
                console.log('Botón no encontrado, usando Enter...');
                await page.keyboard.press('Enter');
            }

            // Esperar y obtener resultado
            await page.waitForSelector("#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:estado", { timeout: 40000 });
            const result = await page.evaluate(() => {
                const element = document.querySelector("#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:estado");
                return element ? element.textContent.trim() : "NO EXISTE";
            });

            await browser.close();
            return result;

        } catch (error) {
            console.error(`Error al consultar RUT ${cedula}:`, error.message);
            if (browser) await browser.close();
            return "ERROR EN MUISCA";
        }
    }

    // Endpoint para consulta individual
    app.post('/check-rut', async (req, res) => {
        try {
            const { cedula } = req.body;
            if (!cedula) return res.status(400).json({ error: "Cédula/NIT requerida" });

            const resultado = await check_RUT(cedula);
            res.json({ cedula, resultado });
        } catch (error) {
            console.error('Error en endpoint /check-rut:', error);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    });

    // Endpoint para procesar archivo Excel
    app.post('/check-excel', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: "Archivo no proporcionado" });

            const inputPath = req.file.path;
            const outputDir = path.join(__dirname, 'results');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const outputPath = path.join(outputDir, `resultado_${Date.now()}.xlsx`);

            // Leer archivo Excel
            const workbook = xlsx.readFile(inputPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: "A" });

            const results = [];
            const BATCH_SIZE = 5; // Procesar en lotes para evitar bloqueos
            const DELAY_BETWEEN_BATCHES = 10000; // 10 segundos entre lotes

            for (let i = 1; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);

                // Procesar lote actual
                for (const row of batch) {
                    const cedula = row.A?.toString();
                    if (!cedula) continue;

                    const delay = Math.floor(Math.random() * 2000) + 1000;
                    console.log(`Consultando ${cedula} después de ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    const resultado = await check_RUT(cedula);
                    results.push({ cedula, resultado });
                    console.log(`Resultado para ${cedula}: ${resultado}`);
                }

                // Esperar entre lotes
                if (i + BATCH_SIZE < data.length) {
                    console.log(`Esperando ${DELAY_BETWEEN_BATCHES/1000} segundos antes del próximo lote...`);
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }

            // Guardar resultados
            const ws = xlsx.utils.json_to_sheet(results);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "Resultados");
            xlsx.writeFile(wb, outputPath);

            // Eliminar archivo temporal
            fs.unlinkSync(inputPath);

            res.json({
                success: true,
                downloadUrl: `http://localhost:${PORT}/results/${path.basename(outputPath)}`,
                totalProcessed: results.length
            });

        } catch (error) {
            console.error('Error en endpoint /check-excel:', error);
            res.status(500).json({ error: "Error procesando el archivo", details: error.message });
        }
    });

    // Iniciar servidor
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

