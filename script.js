// script.js

document.addEventListener('DOMContentLoaded', function() {
    // Element References
    const singleMapperContainer = document.getElementById('single-mapper-container');
    const dualMapperContainer = document.getElementById('dual-mapper-container');
    const imageContainer = document.getElementById('image-container');
    const svgContainer = document.getElementById('svg-container');
    const leftImageContainer = document.getElementById('left-image-container');
    const rightImageContainer = document.getElementById('right-image-container');
    const leftSvgContainer = document.getElementById('left-svg-container');
    const rightSvgContainer = document.getElementById('right-svg-container');
    const imageUpload = document.getElementById('imageUpload');
    const opacitySlider = document.getElementById('opacitySlider');
    const mapColor = document.getElementById('mapColor');
    const mapModal = document.getElementById('mapModal');
    const mapOptions = document.getElementById('mapOptions');
    const closeBtn = document.getElementsByClassName('close')[0];
    const histogramCanvas = document.getElementById('histogramCanvas');
    const galleryAccordion = document.getElementById('galleryAccordion');
    const progressIndicator = document.getElementById('progressIndicator');
    const controls = document.querySelectorAll('.controls');
    const availableMaps = ['Angerer_DE_01', 'Bourdil_FR_01', 'IrisLAB_EN_02', 'IrisLAB_FR_02', 'Jaussas_FR_01', 'Jensen_EN_01', 'Jensen_FR_01', 'Roux_FR_01'];

    const adjustmentSliders = {
        exposure: document.getElementById('exposureSlider'),
        contrast: document.getElementById('contrastSlider'),
        saturation: document.getElementById('saturationSlider'),
        hue: document.getElementById('hueSlider'),
        blur: document.getElementById('blurSlider'),
        shadows: document.getElementById('shadowsSlider'),
        highlights: document.getElementById('highlightsSlider'),
        temperature: document.getElementById('temperatureSlider'),
        sharpness: document.getElementById('sharpnessSlider')
    };

    // State Management
    let currentEye = 'L';
    let isDualViewActive = false;
    let images = { 'L': null, 'R': null };
    let imageSettings = {
        'L': initializeEyeSettings(),
        'R': initializeEyeSettings()
    };
    let svgSettings = {
        'L': {
            svgContent: '',
            mapColor: '#000000',
            opacity: 0.7,
        },
        'R': {
            svgContent: '',
            mapColor: '#000000',
            opacity: 0.7,
        }
    };
    
    // Map Tracking
    let currentMap = availableMaps[0]; // Initialize with the default map
    let customSvgContent = ''; // To store custom SVG content

    function initializeEyeSettings() {
        return {
            rotation: 0,
            scale: 1,
            translateX: 0,
            translateY: 0,
            skewX: 0,
            skewY: 0,
            adjustments: {
                exposure: 0,
                contrast: 0,
                saturation: 0,
                hue: 0,
                blur: 0,
                shadows: 0,
                highlights: 0,
                temperature: 0,
                sharpness: 0
            },
            canvas: null,
            context: null,
            image: null,
            isAutoFitted: false
        };
    }

    // Histogram Functionality using Inline Web Worker
    let histogramWorker;

    function initializeHistogramWorker() {
        const workerScript = `
            self.onmessage = function(e) {
                const { imageData } = e.data;
                const data = imageData.data;
                const red = new Uint32Array(256);
                const green = new Uint32Array(256);
                const blue = new Uint32Array(256);

                for (let i = 0; i < data.length; i += 4) {
                    red[data[i]]++;
                    green[data[i + 1]]++;
                    blue[data[i + 2]]++;
                }

                self.postMessage({ red: Array.from(red), green: Array.from(green), blue: Array.from(blue) });
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerURL = URL.createObjectURL(blob);
        histogramWorker = new Worker(workerURL);
        histogramWorker.onmessage = function(e) {
            drawHistogram(e.data);
        };
    }

    function updateHistogram() {
        const settings = isDualViewActive ? imageSettings['L'] : imageSettings[currentEye];
        if (!settings.canvas || !histogramWorker) return;

        const canvas = settings.canvas;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        histogramWorker.postMessage({ imageData: imageData });
    }

    function drawHistogram(histogramData) {
        const width = histogramCanvas.width;
        const height = histogramCanvas.height;
        const ctx = histogramCanvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);

        // Draw grid for better readability
        drawGrid(ctx, width, height);

        const channels = [
            { data: histogramData.red, color: 'rgba(255,0,0,0.5)' },
            { data: histogramData.green, color: 'rgba(0,255,0,0.5)' },
            { data: histogramData.blue, color: 'rgba(0,0,255,0.5)' }
        ];

        const maxValue = Math.max(
            ...histogramData.red,
            ...histogramData.green,
            ...histogramData.blue
        );

        channels.forEach(channel => {
            ctx.beginPath();
            ctx.strokeStyle = channel.color;
            ctx.lineWidth = 2;

            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * width;
                const y = height - (channel.data[i] / maxValue * height);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.stroke();
        });
    }

    function drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let i = 0; i <= 8; i++) {
            const x = (width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    function setupAdjustmentSliders() {
        Object.entries(adjustmentSliders).forEach(([adjustment, slider]) => {
            if (!slider) return;

            const container = slider.parentElement;
            const valueDisplay = container.querySelector('.adjustment-value');

            slider.addEventListener('input', function() {
                const value = parseFloat(this.value);
                valueDisplay.textContent = value;

                if (isDualViewActive) {
                    ['L', 'R'].forEach(eye => {
                        imageSettings[eye].adjustments[adjustment] = value;
                        updateCanvasImage(eye);
                    });
                } else {
                    imageSettings[currentEye].adjustments[adjustment] = value;
                    updateCanvasImage(currentEye);
                }
            });
        });
    }

    function makeElementDraggable(element) {
        let isDragging = false;
        let startX, startY;
        let initialX, initialY;

        element.addEventListener('pointerdown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
                return;
            }
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('pointermove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialX + dx}px`;
            element.style.top = `${initialY + dy}px`;
        });

        document.addEventListener('pointerup', function() {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }

    function setupImageInteraction(canvas, eye) {
        let isDragging = false;
        let isRotating = false;
        let startX, startY;
        let startTranslateX, startTranslateY;
        let startRotation = 0;

        canvas.style.cursor = 'grab';

        function handleDragStart(e) {
            e.preventDefault();
            if (e.button === 2) { // Right-click for rotation
                isRotating = true;
                startX = e.clientX;
                const settings = imageSettings[eye];
                startRotation = settings.rotation;
            } else if (e.button === 0) { // Left-click for dragging
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const settings = imageSettings[eye];
                startTranslateX = settings.translateX;
                startTranslateY = settings.translateY;
            }
            canvas.style.cursor = 'grabbing';
        }

        function handleDragMove(e) {
            if (!isDragging && !isRotating) return;
            e.preventDefault();

            if (isRotating) {
                const dx = e.clientX - startX;
                const settings = imageSettings[eye];
                settings.rotation = startRotation + dx * 0.5;
                updateCanvasTransform(eye);
            } else if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const settings = imageSettings[eye];
                settings.translateX = startTranslateX + dx;
                settings.translateY = startTranslateY + dy;
                updateCanvasTransform(eye);
            }
        }

        function handleDragEnd() {
            if (isDragging || isRotating) {
                isDragging = false;
                isRotating = false;
                canvas.style.cursor = 'grab';
            }
        }

        function handleWheel(e) {
            e.preventDefault();
            const delta = e.deltaY * -0.0005;
            const settings = imageSettings[eye];

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const newScale = Math.max(0.1, Math.min(10, settings.scale * Math.exp(delta)));
            const scaleChange = newScale / settings.scale;

            settings.translateX = x - (x - settings.translateX) * scaleChange;
            settings.translateY = y - (y - settings.translateY) * scaleChange;
            settings.scale = newScale;

            updateCanvasTransform(eye);
        }

        canvas.addEventListener('pointerdown', handleDragStart);
        canvas.addEventListener('pointermove', handleDragMove);
        canvas.addEventListener('pointerup', handleDragEnd);
        canvas.addEventListener('pointerleave', handleDragEnd);
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    function createCanvasForEye(eye) {
        const settings = imageSettings[eye];
        if (!settings.image) return;

        if (settings.canvas) {
            settings.canvas.remove();
        }

        settings.canvas = document.createElement('canvas');
        settings.context = settings.canvas.getContext('2d', { willReadFrequently: true });
        settings.canvas.className = 'image-canvas';
        settings.canvas.width = settings.image.naturalWidth;
        settings.canvas.height = settings.image.naturalHeight;
        settings.canvas.style.position = 'absolute';
        settings.canvas.style.top = '50%';
        settings.canvas.style.left = '50%';
        settings.canvas.style.transform = 'translate(-50%, -50%)';
        setupImageInteraction(settings.canvas, eye);
    }

    function updateCanvasImage(eye) {
        const settings = imageSettings[eye];
        if (!settings.canvas || !settings.context || !settings.image) return;

        const ctx = settings.context;
        const canvas = settings.canvas;
        const img = settings.image;

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Apply all adjustments
        const filters = [];

        // Exposure
        filters.push(`brightness(${(100 + settings.adjustments.exposure) / 100})`);

        // Contrast
        filters.push(`contrast(${(100 + settings.adjustments.contrast) / 100})`);

        // Saturation
        filters.push(`saturate(${(100 + settings.adjustments.saturation) / 100})`);

        // Hue
        filters.push(`hue-rotate(${settings.adjustments.hue}deg)`);

        // Temperature (approximated using sepia and hue-rotate)
        if (settings.adjustments.temperature !== 0) {
            const temp = settings.adjustments.temperature;
            if (temp > 0) {
                // Warmer
                filters.push(`sepia(${temp}%)`);
                filters.push(`hue-rotate(10deg)`);
            } else {
                // Cooler
                filters.push(`sepia(${Math.abs(temp)}%)`);
                filters.push(`hue-rotate(-10deg)`);
            }
        }

        // Shadows and Highlights (approximated)
        if (settings.adjustments.shadows !== 0) {
            const shadows = settings.adjustments.shadows;
            filters.push(`brightness(${(100 + shadows) / 100})`);
        }

        if (settings.adjustments.highlights !== 0) {
            const highlights = settings.adjustments.highlights;
            filters.push(`contrast(${(100 + highlights) / 100})`);
        }

        // Sharpness (approximated using contrast)
        if (settings.adjustments.sharpness !== 0) {
            const sharpness = settings.adjustments.sharpness;
            filters.push(`contrast(${(100 + sharpness) / 100})`);
        }

        // Blur
        if (settings.adjustments.blur !== 0) {
            filters.push(`blur(${settings.adjustments.blur}px)`);
        }

        ctx.filter = filters.join(' ');
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
        applyCustomAdjustments(ctx, eye, settings);
        updateCanvasTransform(eye);

        updateHistogram();
    }

    function applyCustomAdjustments(ctx, eye, settings) {
        // Additional adjustments like shadows and highlights can be implemented here if needed
        // For more advanced adjustments, consider using canvas pixel manipulation or WebGL shaders
        // This function is a placeholder for any future custom adjustments
    }

    function updateCanvasTransform(eye) {
        const settings = imageSettings[eye];
        if (!settings.canvas) return;

        settings.canvas.style.transform = `
            translate(-50%, -50%)
            translate(${settings.translateX}px, ${settings.translateY}px)
            rotate(${settings.rotation}deg)
            scale(${settings.scale})
            skew(${settings.skewX}deg, ${settings.skewY}deg)
        `;
    }

    function loadImageForSpecificEye(eye) {
        const container = isDualViewActive ? 
            (eye === 'L' ? leftImageContainer : rightImageContainer) : imageContainer;
        
        if (!container) return;
        
        container.innerHTML = '';
        const settings = imageSettings[eye];
        
        if (settings.canvas) {
            container.appendChild(settings.canvas);
            autoFitImage(settings);
            updateCanvasImage(eye);
        }
    }

    function autoFitImage(settings) {
        if (!settings.image) return;

        if (settings.isAutoFitted) return;

        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        const imageWidth = settings.image.naturalWidth;
        const imageHeight = settings.image.naturalHeight;

        const scaleX = containerWidth / imageWidth;
        const scaleY = containerHeight / imageHeight;
        const scale = Math.min(scaleX, scaleY) * 0.8;

        settings.scale = scale;
        settings.translateX = 0;
        settings.translateY = 0;
        settings.rotation = 0;

        updateCanvasTransform(currentEye);

        settings.isAutoFitted = true;
    }

    function addToGallery(imageDataUrl, name) {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.innerHTML = `
            <div class="gallery-item-header">
                <span class="image-name">${name}</span>
                <div class="gallery-item-controls">
                    <button class="btn rename-btn">Rename</button>
                    <button class="btn load-btn">Load</button>
                </div>
            </div>
            <div class="gallery-item-content">
                <img src="${imageDataUrl}" alt="${name}" loading="lazy">
            </div>
        `;

        setupGalleryItemEvents(galleryItem, imageDataUrl);
        galleryAccordion.appendChild(galleryItem);
    }

    function setupGalleryItemEvents(galleryItem, imageDataUrl) {
        const imageNameElement = galleryItem.querySelector('.image-name');
        const renameBtn = galleryItem.querySelector('.rename-btn');
        const loadBtn = galleryItem.querySelector('.load-btn');
        
        renameBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentName = imageNameElement.textContent;
            const newName = prompt('Enter new name:', currentName);
            if (newName?.trim()) {
                imageNameElement.textContent = newName.trim();
            }
        });

        loadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            loadImageFromGallery(imageDataUrl);
        });
    }

    function loadImageFromGallery(imageDataUrl) {
        const img = new Image();
        img.onload = function() {
            if (isDualViewActive) {
                imageSettings['L'].image = img;
                imageSettings['R'].image = img;
                createCanvasForEye('L');
                createCanvasForEye('R');
                loadImageForSpecificEye('L');
                loadImageForSpecificEye('R');
            } else {
                imageSettings[currentEye].image = img;
                createCanvasForEye(currentEye);
                loadImageForSpecificEye(currentEye);
            }
            resetAdjustments();
        };
        img.src = imageDataUrl;
    }

    function resetAdjustments() {
        const defaultAdjustments = {
            exposure: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            blur: 0,
            shadows: 0,
            highlights: 0,
            temperature: 0,
            sharpness: 0
        };

        if (isDualViewActive) {
            imageSettings['L'].adjustments = { ...defaultAdjustments };
            imageSettings['R'].adjustments = { ...defaultAdjustments };
        } else {
            imageSettings[currentEye].adjustments = { ...defaultAdjustments };
        }
        
        Object.entries(adjustmentSliders).forEach(([adjustment, slider]) => {
            if (!slider) return;
            
            slider.value = defaultAdjustments[adjustment];
            const valueDisplay = slider.parentElement.querySelector('.adjustment-value');
            if (valueDisplay) {
                valueDisplay.textContent = defaultAdjustments[adjustment];
            }
        });

        if (isDualViewActive) {
            updateCanvasImage('L');
            updateCanvasImage('R');
        } else {
            updateCanvasImage(currentEye);
        }
    }

    function switchEye(eye) {
        if (currentEye === eye) return;
        
        currentEye = eye;
        loadSVG(currentMap, eye);
        loadImageForSpecificEye(eye);
        updateSVGContainers(eye);
        
        if (opacitySlider) {
            opacitySlider.value = svgSettings[eye].opacity;
        }
        if (mapColor) {
            mapColor.value = svgSettings[eye].mapColor;
        }
        
        Object.entries(adjustmentSliders).forEach(([adjustment, slider]) => {
            if (!slider) return;
            
            const value = imageSettings[eye].adjustments[adjustment];
            slider.value = value;
            const valueDisplay = slider.parentElement.querySelector('.adjustment-value');
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
        });
    }

    function toggleDualView() {
        isDualViewActive = !isDualViewActive;
        
        if (isDualViewActive) {
            singleMapperContainer.style.display = 'none';
            dualMapperContainer.style.display = 'flex';
            
            ['L', 'R'].forEach(eye => {
                if (imageSettings[eye].image) {
                    loadSVG(currentMap, eye);
                    updateSVGContainers(eye);
                    loadImageForSpecificEye(eye);
                }
            });
        } else {
            dualMapperContainer.style.display = 'none';
            singleMapperContainer.style.display = 'block';
            
            loadSVG(currentMap, currentEye);
            updateSVGContainers(currentEye);
            loadImageForSpecificEye(currentEye);
        }

        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                if (imageSettings[eye].canvas) updateCanvasImage(eye);
            });
        } else {
            if (imageSettings[currentEye].canvas) updateCanvasImage(currentEye);
        }
        updateHistogram();
    }

    function updateSVGContainers(eye) {
        if (isDualViewActive) {
            if (eye === 'L') {
                if (leftSvgContainer) {
                    leftSvgContainer.style.opacity = svgSettings['L'].opacity;
                    changeMapColor(svgSettings['L'].mapColor, 'L');
                }
            } else if (eye === 'R') {
                if (rightSvgContainer) {
                    rightSvgContainer.style.opacity = svgSettings['R'].opacity;
                    changeMapColor(svgSettings['R'].mapColor, 'R');
                }
            }
        } else {
            if (svgContainer) {
                svgContainer.style.opacity = svgSettings[currentEye].opacity;
                changeMapColor(svgSettings[currentEye].mapColor, currentEye);
            }
        }
    }

    // Event Listeners for Eye Buttons
    document.getElementById('leftEye')?.addEventListener('click', () => {
        if (isDualViewActive) {
            isDualViewActive = false;
            currentEye = 'L';
            
            const btns = document.querySelectorAll('.eye-btn');
            btns.forEach(btn => btn.classList.remove('active'));
            document.getElementById('leftEye').classList.add('active');
            
            dualMapperContainer.style.display = 'none';
            singleMapperContainer.style.display = 'block';
            
            loadSVG(currentMap, 'L');
            updateSVGContainers('L');
            loadImageForSpecificEye('L');
        } else {
            switchEye('L');
            const btns = document.querySelectorAll('.eye-btn');
            btns.forEach(btn => btn.classList.remove('active'));
            document.getElementById('leftEye').classList.add('active');
        }
    });

    document.getElementById('rightEye')?.addEventListener('click', () => {
        if (isDualViewActive) {
            isDualViewActive = false;
            currentEye = 'R';
            
            const btns = document.querySelectorAll('.eye-btn');
            btns.forEach(btn => btn.classList.remove('active'));
            document.getElementById('rightEye').classList.add('active');
            
            dualMapperContainer.style.display = 'none';
            singleMapperContainer.style.display = 'block';
            
            loadSVG(currentMap, 'R');
            updateSVGContainers('R');
            loadImageForSpecificEye('R');
        } else {
            switchEye('R');
            const btns = document.querySelectorAll('.eye-btn');
            btns.forEach(btn => btn.classList.remove('active'));
            document.getElementById('rightEye').classList.add('active');
        }
    });

    document.getElementById('bothEyes')?.addEventListener('click', function() {
        toggleDualView();
        
        const btns = document.querySelectorAll('.eye-btn');
        btns.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
    });

    // Save functionality
    document.getElementById('save')?.addEventListener('click', () => {
        const containerToCapture = isDualViewActive ? dualMapperContainer : singleMapperContainer;
        if (!containerToCapture) return;

        progressIndicator.style.display = 'flex';

        setTimeout(() => {
            html2canvas(containerToCapture, {
                useCORS: true,
                allowTaint: false,
                backgroundColor: null,
                scale: 2,
                width: containerToCapture.offsetWidth,
                height: containerToCapture.offsetHeight,
                windowWidth: containerToCapture.scrollWidth,
                windowHeight: containerToCapture.scrollHeight,
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `iris_map_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                progressIndicator.style.display = 'none';
            }).catch(error => {
                console.error('Error saving image:', error);
                alert('Failed to save the image. Please try again.');
                progressIndicator.style.display = 'none';
            });
        }, 100);
    });

    // SVG and opacity controls
    opacitySlider?.addEventListener('input', function() {
        const newOpacity = parseFloat(this.value);
        if (isDualViewActive) {
            leftSvgContainer.style.opacity = newOpacity;
            rightSvgContainer.style.opacity = newOpacity;
            svgSettings['L'].opacity = newOpacity;
            svgSettings['R'].opacity = newOpacity;
        } else {
            svgContainer.style.opacity = newOpacity;
            svgSettings[currentEye].opacity = newOpacity;
        }
    });

    mapColor?.addEventListener('input', function() {
        const newColor = this.value;
        if (isDualViewActive) {
            changeMapColor(newColor, 'L');
            changeMapColor(newColor, 'R');
        } else {
            changeMapColor(newColor, currentEye);
        }
    });

    // Map selection modal
    document.getElementById('selectMap')?.addEventListener('click', () => {
        if (!mapModal || !mapOptions) return;
        
        mapModal.style.display = 'block';
        mapOptions.innerHTML = '';

        availableMaps.forEach(map => {
            const option = document.createElement('div');
            option.className = 'map-option';
            // Assuming you have thumbnail images named as map + '.png' in a 'thumbnails' folder
            option.innerHTML = `
                <img src="thumbnails/${map}.png" alt="${map}">
                <span>${map}</span>
            `;
            option.onclick = function() {
                currentMap = map;
                if (isDualViewActive) {
                    loadSVG(currentMap, 'L');
                    loadSVG(currentMap, 'R');
                } else {
                    loadSVG(currentMap, currentEye);
                }
                mapModal.style.display = 'none';
            };
            mapOptions.appendChild(option);
        });
    });

    // Custom map upload
    document.getElementById('customMap')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.svg';
        input.onchange = e => {
            const file = e.target?.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = event => {
                if (!event.target?.result) return;
                const sanitizedSvg = DOMPurify.sanitize(event.target.result, { USE_PROFILES: { svg: true } });
                
                currentMap = 'custom';
                customSvgContent = sanitizedSvg;
                
                if (isDualViewActive) {
                    if (leftSvgContainer) {
                        leftSvgContainer.innerHTML = customSvgContent;
                        setupSvgElement(leftSvgContainer, 'L');
                        changeMapColor(svgSettings['L'].mapColor, 'L');
                    }
                    if (rightSvgContainer) {
                        rightSvgContainer.innerHTML = customSvgContent;
                        setupSvgElement(rightSvgContainer, 'R');
                        changeMapColor(svgSettings['R'].mapColor, 'R');
                    }
                } else if (svgContainer) {
                    svgContainer.innerHTML = customSvgContent;
                    setupSvgElement(svgContainer, currentEye);
                    changeMapColor(svgSettings[currentEye].mapColor, currentEye);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // Modal controls
    closeBtn?.addEventListener('click', () => {
        if (mapModal) mapModal.style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target === mapModal) {
            mapModal.style.display = 'none';
        }
    });

    // Notes functionality
    document.getElementById('notes')?.addEventListener('click', () => {
        const notes = prompt('Enter notes:');
        if (notes) {
            console.log('Notes saved:', notes);
            alert('Notes saved successfully!');
        }
    });

    // SVG handling functions
    function loadSVG(svgFile, eye = currentEye) {
        const container = isDualViewActive ? 
            (eye === 'L' ? leftSvgContainer : rightSvgContainer) : svgContainer;
        
        if (!container) return;

        if (currentMap === 'custom') {
            container.innerHTML = customSvgContent;
            setupSvgElement(container, eye);
            svgSettings[eye].svgContent = customSvgContent;
            // Apply current color settings after loading
            changeMapColor(svgSettings[eye].mapColor, eye);
        } else {
            fetch(`grids/${currentMap}_${eye}.svg`)
                .then(response => response.text())
                .then(svgContent => {
                    if (!container) return;
                    const sanitizedSVG = DOMPurify.sanitize(svgContent, { 
                        USE_PROFILES: { svg: true, svgFilters: true } 
                    });
                    container.innerHTML = sanitizedSVG;
                    svgSettings[eye].svgContent = sanitizedSVG;
                    setupSvgElement(container, eye);
                    // Apply current color settings after loading
                    changeMapColor(svgSettings[eye].mapColor, eye);
                })
                .catch(error => {
                    console.error('Error loading SVG:', error);
                    if (container) container.innerHTML = '';
                    alert(`Failed to load SVG: ${currentMap}_${eye}.svg`);
                });
        }
    }

    function setupSvgElement(container, eye) {
        const svgElement = container?.querySelector('svg');
        if (!svgElement) return;

        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.style.pointerEvents = 'none';
        svgElement.style.userSelect = 'none';
        
        if (container) {
            container.style.opacity = svgSettings[eye].opacity;
        }
        
        const svgTexts = svgElement.querySelectorAll('text');
        svgTexts.forEach(text => {
            text.style.userSelect = 'none';
        });
    }

    function changeMapColor(color, eye) {
        const container = isDualViewActive ? 
            (eye === 'L' ? leftSvgContainer : rightSvgContainer) : svgContainer;
        
        if (!container) return;

        const svgElements = container.querySelectorAll('svg path, svg line, svg circle, svg polygon, svg polyline, svg ellipse, svg rect');
        svgElements.forEach(element => {
            const tag = element.tagName.toLowerCase();
            // Define which tags should have fill modified
            const fillModifiableTags = ['path', 'circle', 'polygon', 'ellipse', 'rect'];
            
            // Modify stroke for all relevant elements
            if (['path', 'line', 'circle', 'polygon', 'polyline', 'ellipse', 'rect'].includes(tag)) {
                element.setAttribute('stroke', color);
            }

            // Conditionally modify fill
            if (fillModifiableTags.includes(tag)) {
                // Check if the element already has a fill; modify only if necessary
                const currentFill = element.getAttribute('fill');
                if (currentFill && currentFill !== 'none') {
                    element.setAttribute('fill', color);
                }
            }
        });
        
        svgSettings[eye].mapColor = color;
    }

    // Utility functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Drag prevention
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    document.addEventListener('drop', function(e) {
        e.preventDefault();
    });

    // Initialize the application
    function initialize() {
        if (histogramCanvas) {
            histogramCanvas.width = histogramCanvas.offsetWidth || 300;
            histogramCanvas.height = histogramCanvas.offsetHeight || 150;
        }

        loadSVG(currentMap, 'L');
        loadSVG(currentMap, 'R');
        setupAdjustmentSliders();

        controls.forEach(control => {
            makeElementDraggable(control);
        });

        const resizeHandler = debounce(() => {
            if (histogramCanvas) {
                histogramCanvas.width = histogramCanvas.offsetWidth;
                histogramCanvas.height = histogramCanvas.offsetHeight;
                updateHistogram();
            }
        }, 250);

        window.addEventListener('resize', resizeHandler);

        if (opacitySlider) {
            opacitySlider.value = svgSettings[currentEye].opacity;
        }
        if (mapColor) {
            mapColor.value = svgSettings[currentEye].mapColor;
        }

        initializeHistogramWorker();
    }

    // Start the application
    initialize();

    // Event Listeners for Image Upload and Add Image Button
    imageUpload.addEventListener('change', function(e) {
        const files = e.target.files;
        if (!files.length) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    if (isDualViewActive) {
                        imageSettings['L'].image = img;
                        imageSettings['R'].image = img;
                        createCanvasForEye('L');
                        createCanvasForEye('R');
                        loadImageForSpecificEye('L');
                        loadImageForSpecificEye('R');
                    } else {
                        imageSettings[currentEye].image = img;
                        createCanvasForEye(currentEye);
                        loadImageForSpecificEye(currentEye);
                    }
                    resetAdjustments();
                    addToGallery(event.target.result, file.name);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelector('.add-image-btn')?.addEventListener('click', function() {
        imageUpload.click();
    });

    document.getElementById('resetAdjustments')?.addEventListener('click', resetAdjustments);

    // Image transformation controls
    document.getElementById('rotateLeft')?.addEventListener('click', () => {
        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                imageSettings[eye].rotation -= 5;
                updateCanvasTransform(eye);
            });
        } else {
            imageSettings[currentEye].rotation -= 5;
            updateCanvasTransform(currentEye);
        }
    });

    document.getElementById('rotateRight')?.addEventListener('click', () => {
        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                imageSettings[eye].rotation += 5;
                updateCanvasTransform(eye);
            });
        } else {
            imageSettings[currentEye].rotation += 5;
            updateCanvasTransform(currentEye);
        }
    });

    document.getElementById('zoomIn')?.addEventListener('click', () => {
        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                let newScale = (imageSettings[eye].scale || 1) * 1.1;
                newScale = Math.min(newScale, 10);
                imageSettings[eye].scale = newScale;
                updateCanvasTransform(eye);
            });
        } else {
            let newScale = (imageSettings[currentEye].scale || 1) * 1.1;
            newScale = Math.min(newScale, 10);
            imageSettings[currentEye].scale = newScale;
            updateCanvasTransform(currentEye);
        }
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                let newScale = (imageSettings[eye].scale || 1) / 1.1;
                newScale = Math.max(newScale, 0.1);
                imageSettings[eye].scale = newScale;
                updateCanvasTransform(eye);
            });
        } else {
            let newScale = (imageSettings[currentEye].scale || 1) / 1.1;
            newScale = Math.max(newScale, 0.1);
            imageSettings[currentEye].scale = newScale;
            updateCanvasTransform(currentEye);
        }
    });

    // Movement controls
    const moveImage = (direction) => {
        const amount = 10;
        if (isDualViewActive) {
            ['L', 'R'].forEach(eye => {
                const settings = imageSettings[eye];
                switch(direction) {
                    case 'up':
                        settings.translateY -= amount;
                        break;
                    case 'down':
                        settings.translateY += amount;
                        break;
                    case 'left':
                        settings.translateX -= amount;
                        break;
                    case 'right':
                        settings.translateX += amount;
                        break;
                }
                updateCanvasTransform(eye);
            });
        } else {
            const settings = imageSettings[currentEye];
            switch(direction) {
                case 'up':
                    settings.translateY -= amount;
                    break;
                case 'down':
                    settings.translateY += amount;
                    break;
                case 'left':
                    settings.translateX -= amount;
                    break;
                case 'right':
                    settings.translateX += amount;
                    break;
            }
            updateCanvasTransform(currentEye);
        }
    };

    document.getElementById('moveUp')?.addEventListener('click', () => moveImage('up'));
    document.getElementById('moveDown')?.addEventListener('click', () => moveImage('down'));
    document.getElementById('moveLeft')?.addEventListener('click', () => moveImage('left'));
    document.getElementById('moveRight')?.addEventListener('click', () => moveImage('right'));
});
