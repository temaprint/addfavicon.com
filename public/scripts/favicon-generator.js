class FaviconGenerator {
  constructor() {
    this.activeImage = null;
    this.passiveImage = null;
    this.generatedIcons = [];
    this.init();
  }

  init() {
    this.setupDropzones();
    this.setupGenerateButton();
    this.setupDownloadButton();
    this.setupCopyButton();
  }

  setupDropzones() {
    // Active favicon dropzone
    const activeDropzone = document.getElementById('active-dropzone');
    const activeInput = document.getElementById('active-input');

    activeDropzone.addEventListener('click', () => activeInput.click());
    activeDropzone.addEventListener('dragover', this.handleDragOver);
    activeDropzone.addEventListener('drop', (e) => this.handleDrop(e, 'active'));
    activeInput.addEventListener('change', (e) => this.handleFileSelect(e, 'active'));

    // Passive favicon dropzone
    const passiveDropzone = document.getElementById('passive-dropzone');
    const passiveInput = document.getElementById('passive-input');

    passiveDropzone.addEventListener('click', () => passiveInput.click());
    passiveDropzone.addEventListener('dragover', this.handleDragOver);
    passiveDropzone.addEventListener('drop', (e) => this.handleDrop(e, 'passive'));
    passiveInput.addEventListener('change', (e) => this.handleFileSelect(e, 'passive'));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary-400', 'bg-primary-50', 'dark:bg-primary-900/20');
  }

  handleDrop(e, type) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50', 'dark:bg-primary-900/20');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0], type);
    }
  }

  handleFileSelect(e, type) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processFile(files[0], type);
    }
  }

  async processFile(file, type) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (type === 'active') {
          this.activeImage = { file, dataUrl: e.target.result, img };
          this.showPreview('active', e.target.result);
        } else {
          this.passiveImage = { file, dataUrl: e.target.result, img };
          this.showPreview('passive', e.target.result);
        }
        this.updateGenerateButton();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  showPreview(type, dataUrl) {
    const preview = document.getElementById(`${type}-preview`);
    const img = document.getElementById(`${type}-preview-img`);
    img.src = dataUrl;
    preview.classList.remove('hidden');
  }

  updateGenerateButton() {
    const btn = document.getElementById('generate-btn');
    const text = document.getElementById('generate-text');

    if (this.activeImage) {
      btn.disabled = false;
      text.textContent = 'Generate Favicon Package';
    }
  }

  setupGenerateButton() {
    document.getElementById('generate-btn').addEventListener('click', () => {
      if (this.activeImage) {
        this.generateFavicons();
      }
    });
  }

  async generateFavicons() {
    const btn = document.getElementById('generate-btn');
    const text = document.getElementById('generate-text');
    const loading = document.getElementById('generate-loading');

    // Show loading state
    btn.disabled = true;
    text.textContent = 'Generating...';
    loading.classList.remove('hidden');

    try {
      // Generate all favicon sizes
      const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
      this.generatedIcons = [];

      for (const size of sizes) {
        // Generate active favicon
        const activeCanvas = await this.resizeImage(this.activeImage.img, size);
        const activeBlob = await this.canvasToBlob(activeCanvas);
        this.generatedIcons.push({
          name: `favicon-${size}x${size}.png`,
          blob: activeBlob,
          size,
          type: 'active'
        });

        // Generate passive favicon if available
        if (this.passiveImage) {
          const passiveCanvas = await this.resizeImage(this.passiveImage.img, size);
          const passiveBlob = await this.canvasToBlob(passiveCanvas);
          this.generatedIcons.push({
            name: `favicon-passive-${size}x${size}.png`,
            blob: passiveBlob,
            size,
            type: 'passive'
          });
        }
      }

      // Generate favicon.ico (multi-size ICO file)
      const icoBlob = await this.generateICO();
      this.generatedIcons.push({
        name: 'favicon.ico',
        blob: icoBlob,
        size: 'multi',
        type: 'ico'
      });

      // Generate favicon.svg if original is SVG or create optimized SVG
      const svgBlob = await this.generateSVG();
      if (svgBlob) {
        this.generatedIcons.push({
          name: 'favicon.svg',
          blob: svgBlob,
          size: 'vector',
          type: 'svg'
        });
      }
      this.showResults();
      this.generatePreview();
      this.generateHTMLCode();

    } catch (error) {
      console.error('Error generating favicons:', error);
      alert('Error generating favicons. Please try again.');
    } finally {
      // Reset button state
      btn.disabled = false;
      text.textContent = 'Generate Favicon Package';
      loading.classList.add('hidden');
    }
  }

  async generateICO() {
    // Create ICO file with multiple sizes (16x16, 32x32, 48x48)
    const sizes = [16, 32, 48];
    const images = [];

    for (const size of sizes) {
      const canvas = await this.resizeImage(this.activeImage.img, size);
      const imageData = canvas.getContext('2d').getImageData(0, 0, size, size);
      images.push({ size, imageData });
    }

    return this.createICOBlob(images);
  }

  async createICOBlob(images) {
    // ICO file format implementation
    const iconCount = images.length;
    const headerSize = 6 + (iconCount * 16);
    let totalSize = headerSize;

    // Calculate total size
    images.forEach(img => {
      totalSize += 40 + (img.size * img.size * 4); // BITMAPINFOHEADER + RGBA data
    });

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // ICO header
    view.setUint16(0, 0, true); // Reserved
    view.setUint16(2, 1, true); // Type (1 = ICO)
    view.setUint16(4, iconCount, true); // Number of images
    offset = 6;

    let dataOffset = headerSize;

    // Directory entries
    images.forEach(img => {
      const imageSize = 40 + (img.size * img.size * 4);
      view.setUint8(offset, img.size === 256 ? 0 : img.size); // Width
      view.setUint8(offset + 1, img.size === 256 ? 0 : img.size); // Height
      view.setUint8(offset + 2, 0); // Color palette
      view.setUint8(offset + 3, 0); // Reserved
      view.setUint16(offset + 4, 1, true); // Color planes
      view.setUint16(offset + 6, 32, true); // Bits per pixel
      view.setUint32(offset + 8, imageSize, true); // Image size
      view.setUint32(offset + 12, dataOffset, true); // Image offset
      offset += 16;
      dataOffset += imageSize;
    });

    // Image data
    images.forEach(img => {
      // BITMAPINFOHEADER
      view.setUint32(offset, 40, true); // Header size
      view.setInt32(offset + 4, img.size, true); // Width
      view.setInt32(offset + 8, img.size * 2, true); // Height (doubled for ICO)
      view.setUint16(offset + 12, 1, true); // Planes
      view.setUint16(offset + 14, 32, true); // Bit count
      view.setUint32(offset + 16, 0, true); // Compression
      view.setUint32(offset + 20, img.size * img.size * 4, true); // Size image
      view.setInt32(offset + 24, 0, true); // X pixels per meter
      view.setInt32(offset + 28, 0, true); // Y pixels per meter
      view.setUint32(offset + 32, 0, true); // Colors used
      view.setUint32(offset + 36, 0, true); // Colors important
      offset += 40;

      // RGBA data (bottom-up)
      const data = img.imageData.data;
      for (let y = img.size - 1; y >= 0; y--) {
        for (let x = 0; x < img.size; x++) {
          const srcIndex = (y * img.size + x) * 4;
          view.setUint8(offset++, data[srcIndex + 2]); // B
          view.setUint8(offset++, data[srcIndex + 1]); // G
          view.setUint8(offset++, data[srcIndex]); // R
          view.setUint8(offset++, data[srcIndex + 3]); // A
        }
      }
    });

    return new Blob([buffer], { type: 'image/x-icon' });
  }

  async generateSVG() {
    // If the original image is SVG, try to use it directly
    if (this.activeImage.file.type === 'image/svg+xml') {
      return this.activeImage.file;
    }

    // For other formats, create a simple SVG wrapper
    const canvas = await this.resizeImage(this.activeImage.img, 32);
    const dataUrl = canvas.toDataURL('image/png');

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="32" height="32" viewBox="0 0 32 32">
  <image width="32" height="32" xlink:href="${dataUrl}"/>
</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
  }
  async resizeImage(img, size) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = size;
    canvas.height = size;

    // High-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, size, size);
    return canvas;
  }

  canvasToBlob(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png', 1);
    });
  }

  showResults() {
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  }

  generatePreview() {
    const grid = document.getElementById('preview-grid');
    grid.innerHTML = '';

    const previewSizes = [16, 32, 48, 64, 128, 180, 192, 256];

    previewSizes.forEach(size => {
      const activeIcon = this.generatedIcons.find(icon => icon.size === size && icon.type === 'active');
      if (activeIcon) {
        const url = URL.createObjectURL(activeIcon.blob);
        const div = document.createElement('div');
        div.className = 'text-center';
        div.innerHTML = `
          <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600 mb-2">
            <img src="${url}" alt="${size}x${size}" class="w-8 h-8 mx-auto">
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">${size}×${size}</span>
        `;
        grid.appendChild(div);
      }
    });
  }

  generateHTMLCode() {
    const hasPassive = this.passiveImage !== null;

    let html = `<!-- Favicon Package - Generated by AddFavicon.com -->\n`;
    html += `<link rel="icon" href="/favicon.ico" sizes="32x32">\n`;
    html += `<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n`;
    html += `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n`;
    html += `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n`;
    html += `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">\n`;
    html += `<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180x180.png">\n`;
    html += `<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">\n`;
    html += `<link rel="icon" type="image/png" sizes="256x256" href="/favicon-256x256.png">\n`;
    html += `<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png">\n`;
    html += `<link rel="manifest" href="/site.webmanifest">\n`;
    html += `<meta name="theme-color" content="#3b82f6">\n\n`;

    if (hasPassive) {
      html += `<!-- Dynamic Favicon Switching Script -->\n`;
      html += `<script>\n`;
      html += `  let isActive = true;\n`;
      html += `  const activeFavicon = '/favicon.ico';\n`;
      html += `  const passiveFavicon = '/favicon-passive-32x32.png';\n`;
      html += `  \n`;
      html += `  function updateFavicon() {\n`;
      html += `    const link = document.querySelector("link[rel='icon'][href*='.ico']");\n`;
      html += `    if (link) {\n`;
      html += `      link.href = isActive ? activeFavicon : passiveFavicon;\n`;
      html += `    }\n`;
      html += `  }\n`;
      html += `  \n`;
      html += `  window.addEventListener('focus', () => {\n`;
      html += `    isActive = true;\n`;
      html += `    updateFavicon();\n`;
      html += `  });\n`;
      html += `  \n`;
      html += `  window.addEventListener('blur', () => {\n`;
      html += `    isActive = false;\n`;
      html += `    updateFavicon();\n`;
      html += `  });\n`;
      html += `</script>`;
    }

    document.getElementById('html-code').textContent = html;
  }

  setupDownloadButton() {
    document.getElementById('download-btn').addEventListener('click', () => {
      this.downloadZip();
    });
  }

  async downloadZip() {
    try {
      // Import JSZip dynamically
      const JSZip = (await import('https://cdn.skypack.dev/jszip')).default;
      const zip = new JSZip();

      // Add all generated icons to zip
      for (const icon of this.generatedIcons) {
        zip.file(icon.name, icon.blob);
      }

      // Add manifest.json
      const manifest = {
        name: "Your App",
        short_name: "App",
        icons: [
          { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/favicon-512x512.png", sizes: "512x512", type: "image/png" }
        ],
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone"
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // Add HTML snippet
      const htmlCode = document.getElementById('html-code').textContent;
      zip.file('favicon-html-code.txt', htmlCode);

      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'favicon-package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Error creating download package. Please try again.');
    }
  }

  setupCopyButton() {
    document.getElementById('copy-btn').addEventListener('click', async () => {
      const code = document.getElementById('html-code').textContent;
      const btn = document.getElementById('copy-btn');

      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Copied!';
        btn.classList.add('bg-accent-100', 'text-accent-700', 'dark:bg-accent-900', 'dark:text-accent-300');

        setTimeout(() => {
          btn.textContent = 'Copy Code';
          btn.classList.remove('bg-accent-100', 'text-accent-700', 'dark:bg-accent-900', 'dark:text-accent-300');
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        alert('Failed to copy code. Please select and copy manually.');
      }
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new FaviconGenerator();
});