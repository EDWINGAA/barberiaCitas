/**
 * Compresion de imagenes en el navegador.
 *
 * La usan los DOS modos de la aplicacion:
 *
 *  - En modo demo, porque localStorage no aguanta fotos sin procesar.
 *  - En modo Firebase, como alternativa a Cloud Storage. Storage exige
 *    el plan de pago (Blaze) con tarjeta, y para una barberia con unas
 *    decenas de fotos no compensa: guardar la imagen ya comprimida
 *    dentro del propio documento de Firestore sale gratis y funciona
 *    igual de bien.
 */

/** Un documento de Firestore no puede pasar de 1 MB contando todo */
const LIMITE_FIRESTORE = 1024 * 1024

/**
 * Margen de seguridad. El resto del documento (titulo, fechas, ids)
 * ocupa muy poco, pero mas vale no acercarse al limite duro.
 */
export const MAXIMO_DATA_URL = 700 * 1024

/** Calidades y tamanos que se prueban, del mejor al mas comprimido */
const PASADAS = [
  { maxSize: 900, quality: 0.75 },
  { maxSize: 800, quality: 0.65 },
  { maxSize: 640, quality: 0.55 },
  { maxSize: 480, quality: 0.45 },
]

/**
 * Dibuja el archivo en un canvas reducido y devuelve una data URL JPEG.
 *
 * @param {File}   file      archivo elegido por el usuario
 * @param {number} maxSize   lado mayor en pixeles
 * @param {number} quality   0 a 1
 * @returns {Promise<string>} data URL lista para guardar
 */
export function comprimirImagen(file, maxSize = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('El archivo no es una imagen valida.'))
      img.onload = () => {
        const escala = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Comprime hasta que la data URL quepa con holgura en un documento de
 * Firestore. Va bajando calidad y tamano en pasadas sucesivas y se queda
 * con la primera que entra.
 *
 * @param {File} file
 * @returns {Promise<string>} data URL por debajo de MAXIMO_DATA_URL
 */
export async function comprimirParaDocumento(file) {
  let ultima = ''

  for (const pasada of PASADAS) {
    // eslint-disable-next-line no-await-in-loop -- son intentos en cascada
    ultima = await comprimirImagen(file, pasada.maxSize, pasada.quality)
    if (pesoDeDataURL(ultima) <= MAXIMO_DATA_URL) return ultima
  }

  // Ni con la pasada mas agresiva cabe: mejor decirlo que guardar algo
  // que Firestore va a rechazar con un error incomprensible.
  if (pesoDeDataURL(ultima) > LIMITE_FIRESTORE) {
    throw new Error(
      'La imagen es demasiado grande incluso comprimida. Prueba con una foto mas pequena.'
    )
  }

  return ultima
}

/** Bytes reales que ocupa una data URL (base64 abulta un tercio mas) */
export function pesoDeDataURL(dataURL) {
  const base64 = String(dataURL).split(',')[1] || ''
  return Math.ceil((base64.length * 3) / 4)
}
