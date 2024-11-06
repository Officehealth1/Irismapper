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
    const closeBtn = document.querySelector('.close');
    const histogramCanvas = document.getElementById('histogramCanvas');
    const progressIndicator = document.getElementById('progressIndicator');
    const controls = document.querySelectorAll('.controls');
    const galleryAccordion = document.getElementById('galleryAccordion');
    const addImageBtn = document.getElementById('addImageBtn');
    const availableMaps = [
        'Angerer_Map_DE_V1',
        'Bourdil_Map_FR_V1',
        'IrisLAB_Map_EN_V2',
        'IrisLAB_Map_FR_V2',
        'Jaussas_Map_FR_V1',
        'Jensen_Map_EN_V1',
        'Jensen_Map_FR_V1',
        'Roux_Map_FR_V1'
    ];

    const adjustmentSliders = {
        exposure: document.getElementById('exposureSlider'),
        contrast: document.getElementById('contrastSlider'),
        saturation: document.getElementById('saturationSlider'),
        hue: document.getElementById('hueSlider'),
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
    const resetButton = document.getElementById('resetAdjustments');
    
    // Add this with your other event listeners
    if (resetButton) {
        resetButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Reset button clicked');
            resetAdjustments();
        });
    }
    
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
    

    // Histogram Data
    let histogramData = null;

    function updateHistogram() {
        const settings = isDualViewActive ? imageSettings['L'] : imageSettings[currentEye];
        if (!settings.canvas) return;

        const canvas = settings.canvas;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const data = imageData.data;
        const length = data.length;
        const histogramR = new Uint32Array(256);
        const histogramG = new Uint32Array(256);
        const histogramB = new Uint32Array(256);

        for (let i = 0; i < length; i += 4) {
            histogramR[data[i]]++;
            histogramG[data[i + 1]]++;
            histogramB[data[i + 2]]++;
        }

        histogramData = { red: histogramR, green: histogramG, blue: histogramB };
        drawHistogram(histogramData);
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
            ctx.lineWidth = 1;

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

            const debouncedUpdate = debounce(function() {
                const value = parseFloat(slider.value);
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
            }, 100); // Adjust the debounce delay as needed
            
            slider.addEventListener('input', debouncedUpdate);
            
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
            canvas.style.cursor = isRotating ? 'crosshair' : 'grabbing';
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
    
        // Create or get offscreen canvas
        if (!settings.offscreenCanvas) {
            settings.offscreenCanvas = new OffscreenCanvas(
                settings.image.naturalWidth,
                settings.image.naturalHeight
            );
            settings.offscreenCtx = settings.offscreenCanvas.getContext('2d', {
                willReadFrequently: true
            });
        }
    
        const ctx = settings.context;
        const offCtx = settings.offscreenCtx;
        const canvas = settings.canvas;
        const img = settings.image;
        const width = img.naturalWidth;
        const height = img.naturalHeight;
    
        // Only resize if dimensions changed
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            settings.offscreenCanvas.width = width;
            settings.offscreenCanvas.height = height;
        }
    
        offCtx.clearRect(0, 0, width, height);
        offCtx.save();
    
        // Batch filters for better performance
        const filters = [
            `brightness(${(100 + settings.adjustments.exposure) / 100})`,
            `contrast(${(100 + settings.adjustments.contrast) / 100})`,
            `saturate(${(100 + settings.adjustments.saturation) / 100})`,
            `hue-rotate(${settings.adjustments.hue}deg)`
        ];
    
        // Only add conditional filters if needed
        if (settings.adjustments.temperature !== 0) {
            const temp = settings.adjustments.temperature;
            const warmFilter = temp > 0 ? `sepia(${temp}%)` : '';
            const coolFilter = temp < 0 ? `hue-rotate(180deg) saturate(${Math.abs(temp)}%)` : '';
            filters.push(warmFilter || coolFilter);
        }
    
    
        offCtx.filter = filters.join(' ');
    
        // Use requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
            if (settings.adjustments.shadows !== 0 || settings.adjustments.highlights !== 0) {
                applyShadowsHighlights(offCtx, img, settings);
            } else {
                offCtx.drawImage(img, 0, 0, width, height);
            }
    
            offCtx.restore();
            
            // Apply custom adjustments to offscreen canvas
            if (settings.adjustments.sharpness !== 0) {
                applySharpness(offCtx, settings.adjustments.sharpness);
            }
    
            // Copy to main canvas
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(settings.offscreenCanvas, 0, 0);
            
            // Update transform
            updateCanvasTransform(eye);
            
            // Debounce histogram update
            if (!settings.histogramTimeout) {
                settings.histogramTimeout = setTimeout(() => {
                    updateHistogram();
                    settings.histogramTimeout = null;
                }, 100);
            }
        });
    }

    function applyShadowsHighlights(ctx, img, settings) {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        // Draw original image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
    
        // Calculate adjustments
        const shadows = settings.adjustments.shadows / 100;
        const highlights = settings.adjustments.highlights / 100;
    
        // Loop through pixels
        for (let i = 0; i < data.length; i += 4) {
            // Calculate luminance
            const luminance = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    
            if (luminance < 128) {
                // Shadows adjustment
                const factor = 1 + shadows;
                data[i] *= factor;
                data[i+1] *= factor;
                data[i+2] *= factor;
            } else {
                // Highlights adjustment
                const factor = 1 - highlights;
                data[i] *= factor;
                data[i+1] *= factor;
                data[i+2] *= factor;
            }
        }
    
        // Put adjusted data back
        ctx.putImageData(imageData, 0, 0);
    }
    
    

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
    
        if(max === min){
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                case b: h = ((r - g) / d + 4); break;
            }
            h /= 6;
        }
    
        return [h, s, l];
    }
    
    function hslToRgb(h, s, l){
        let r, g, b;
    
        if(s === 0){
            r = g = b = l; // achromatic
        } else {
            function hue2rgb(p, q, t){
                if(t < 0) t += 1;
                if(t > 1) t -= 1;
                if(t < 1/6) return p + (q - p) * 6 * t;
                if(t < 1/2) return q;
                if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }
    
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
    
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
    
        return [r * 255, g * 255, b * 255];
    }

    function applyCustomAdjustments(ctx, eye, settings) {
        // Implement sharpness using convolution filter
        if (settings.adjustments.sharpness !== 0) {
            const amount = settings.adjustments.sharpness / 100;
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;
            const imageData = ctx.getImageData(0, 0, width, height);

            const weights = [
                0, -1 * amount, 0,
                -1 * amount, 4 * amount + 1, -1 * amount,
                0, -1 * amount, 0
            ];

            convolve(imageData, weights);
            ctx.putImageData(imageData, 0, 0);
        }
    }

    function convolve(imageData, weights) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const side = Math.round(Math.sqrt(weights.length));
        const halfSide = Math.floor(side / 2);

        const output = new Uint8ClampedArray(pixels.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;
                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = y + cy - halfSide;
                        const scx = x + cx - halfSide;
                        if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                            const offset = (scy * width + scx) * 4;
                            const wt = weights[cy * side + cx];
                            r += pixels[offset] * wt;
                            g += pixels[offset + 1] * wt;
                            b += pixels[offset + 2] * wt;
                        }
                    }
                }
                const offset = (y * width + x) * 4;
                output[offset] = r;
                output[offset + 1] = g;
                output[offset + 2] = b;
                output[offset + 3] = pixels[offset + 3];
            }
        }
        imageData.data.set(output);
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


    
    // Replace your existing resetAdjustments function with this updated version
    function resetAdjustments() {
        console.log('Reset function called'); // Debug log
    
        const defaultAdjustments = {
            exposure: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            shadows: 0,
            highlights: 0,
            temperature: 0,
            sharpness: 0
        };
    
        const eyesToReset = isDualViewActive ? ['L', 'R'] : [currentEye];
        console.log('Resetting eyes:', eyesToReset); // Debug log
    
        eyesToReset.forEach(eye => {
            // Reset only histogram-related adjustments
            imageSettings[eye].adjustments = { 
                ...imageSettings[eye].adjustments,
                ...defaultAdjustments
            };
    
            // Update UI sliders
            Object.entries(adjustmentSliders).forEach(([adjustment, slider]) => {
                if (!slider) return;
                
                // Only reset sliders that are in defaultAdjustments
                if (defaultAdjustments.hasOwnProperty(adjustment)) {
                    slider.value = 0;
                    // Update value display
                    const valueDisplay = slider.parentElement?.querySelector('.adjustment-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = '0';
                    }
                }
            });
    
            // Clear any pending timeouts
            if (imageSettings[eye].histogramTimeout) {
                clearTimeout(imageSettings[eye].histogramTimeout);
                imageSettings[eye].histogramTimeout = null;
            }
    
            // Update canvas display
            if (imageSettings[eye].canvas && imageSettings[eye].image) {
                requestAnimationFrame(() => {
                    updateCanvasImage(eye);
                });
            }
        });
    
        // Update histogram after reset
        setTimeout(updateHistogram, 100);
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

        // Populate map options as a simple list
        availableMaps.forEach(map => {
            const option = document.createElement('div');
            option.className = 'map-option';
            option.innerHTML = `<span>${map}</span>`;
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
    
        // Get all SVG elements including nested ones
        const allElements = container.getElementsByTagName('*');
    
        // Specific handling for IrisLAB map elements
        for (let element of allElements) {
            const tag = element.tagName.toLowerCase();
            
            // Handle text elements
            if (tag === 'text' || tag === 'tspan') {
                element.setAttribute('fill', color);
                element.setAttribute('stroke', 'none'); // Prevent text outlines
                continue;
            }
    
            // Handle paths (anatomical sections and lines)
            if (tag === 'path' || tag === 'line' || tag === 'circle') {
                // Get the current stroke-width
                const strokeWidth = element.getAttribute('stroke-width');
                
                // Set stroke color
                element.setAttribute('stroke', color);
                
                // Ensure thin lines remain visible
                if (strokeWidth === null || strokeWidth === '') {
                    element.setAttribute('stroke-width', '0.5');
                }
    
                // Only set fill for closed paths that originally had fill
                const currentFill = element.getAttribute('fill');
                if (currentFill && currentFill !== 'none') {
                    element.setAttribute('fill', color);
                }
                continue;
            }
    
            // Handle groups
            if (tag === 'g') {
                // Check if group has direct style attributes
                if (element.hasAttribute('stroke')) {
                    element.setAttribute('stroke', color);
                }
                if (element.hasAttribute('fill')) {
                    element.setAttribute('fill', color);
                }
                continue;
            }
    
            // Handle other specific elements
            if (['polygon', 'polyline', 'rect', 'ellipse'].includes(tag)) {
                element.setAttribute('stroke', color);
                // Check if element should have fill
                const currentFill = element.getAttribute('fill');
                if (currentFill && currentFill !== 'none') {
                    element.setAttribute('fill', color);
                }
            }
        }
    
        // Handle any CSS styles
        const styleElement = container.querySelector('style');
        if (styleElement) {
            let cssText = styleElement.textContent;
            // Replace all color definitions with new color
            cssText = cssText.replace(/(?:rgb|rgba|#)[^;{}]*/g, color);
            styleElement.textContent = cssText;
        }
    
        // Store color in settings
        svgSettings[eye].mapColor = color;
    
        // Force repaint
        container.style.display = 'none';
        container.offsetHeight; // Trigger reflow
        container.style.display = '';
    }

    // Auto Levels Functionality
    document.getElementById('autoLevels')?.addEventListener('click', () => {
        if (!histogramData) return;

        const settings = isDualViewActive ? ['L', 'R'] : [currentEye];
        settings.forEach(eye => {
            const adjustments = imageSettings[eye].adjustments;
            const histogram = histogramData;

            // Calculate mean brightness
            const totalPixels = histogram.red.reduce((a, b) => a + b, 0);
            const meanBrightness = (histogram.red.reduce((sum, val, idx) => sum + val * idx, 0) +
                histogram.green.reduce((sum, val, idx) => sum + val * idx, 0) +
                histogram.blue.reduce((sum, val, idx) => sum + val * idx, 0)) / (totalPixels * 3);

            // Adjust exposure based on mean brightness
            adjustments.exposure = (128 - meanBrightness) / 128 * 100;

            // Adjust contrast based on histogram spread
            const minBrightness = Math.min(
                histogram.red.findIndex(val => val > 0),
                histogram.green.findIndex(val => val > 0),
                histogram.blue.findIndex(val => val > 0)
            );
            const maxBrightness = Math.max(
                255 - [...histogram.red].reverse().findIndex(val => val > 0),
                255 - [...histogram.green].reverse().findIndex(val => val > 0),
                255 - [...histogram.blue].reverse().findIndex(val => val > 0)
            );
            const brightnessRange = maxBrightness - minBrightness;

            adjustments.contrast = ((255 / brightnessRange) - 1) * 100;

            // Update sliders and images
            adjustmentSliders.exposure.value = adjustments.exposure;
            adjustmentSliders.contrast.value = adjustments.contrast;
            adjustmentSliders.exposure.parentElement.querySelector('.adjustment-value').textContent = adjustments.exposure.toFixed(0);
            adjustmentSliders.contrast.parentElement.querySelector('.adjustment-value').textContent = adjustments.contrast.toFixed(0);

            updateCanvasImage(eye);
        });
    });

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

        class MobileUIManager {
            constructor() {
                this.menuState = {
                    isOpen: false,
                    activePanel: null
                };
                this.touchStartX = 0;
                this.touchStartY = 0;
                this.menuContainer = document.getElementById('menuContainer');
                this.initializeMobileMenu();
            }
        
            initializeMobileMenu() {
                // Create mobile menu toggle
                const menuToggle = document.createElement('button');
                menuToggle.className = 'mobile-menu-toggle';
                menuToggle.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                    </svg>
                `;
                document.body.appendChild(menuToggle);
        
                // Create bottom navigation
                const bottomNav = document.createElement('div');
                bottomNav.className = 'bottom-navigation';
                bottomNav.innerHTML = `
                    <div class="nav-item" data-panel="transform">
                        <svg><!-- Transform icon --></svg>
                        <span>Transform</span>
                    </div>
                    <div class="nav-item" data-panel="adjustments">
                        <svg><!-- Adjustments icon --></svg>
                        <span>Adjust</span>
                    </div>
                    <div class="nav-item" data-panel="maps">
                        <svg><!-- Maps icon --></svg>
                        <span>Maps</span>
                    </div>
                `;
                document.body.appendChild(bottomNav);
        
                this.setupEventListeners();
            }
        
            setupEventListeners() {
                // Touch event handling
                document.addEventListener('touchstart', this.handleTouchStart.bind(this));
                document.addEventListener('touchmove', this.handleTouchMove.bind(this));
                document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
                // Panel navigation
                const navItems = document.querySelectorAll('.nav-item');
                navItems.forEach(item => {
                    item.addEventListener('click', () => this.togglePanel(item.dataset.panel));
                });
                
            }
        
            handleTouchStart(e) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
        
            handleTouchMove(e) {
                if (!this.touchStartX || !this.touchStartY) return;
        
                const xDiff = this.touchStartX - e.touches[0].clientX;
                const yDiff = this.touchStartY - e.touches[0].clientY;
        
                // Implement swipe logic
                if (Math.abs(xDiff) > Math.abs(yDiff)) {
                    if (xDiff > 0) {
                        // Swipe left - close panel
                        this.closeActivePanel();
                    } else {
                        // Swipe right - open panel
                        this.openLastPanel();
                    }
                }
            }
        
            togglePanel(panelId) {
                const panel = document.querySelector(`.panel-${panelId}`);
                if (this.menuState.activePanel === panelId) {
                    this.closeActivePanel();
                } else {
                    this.openPanel(panelId);
                }
            }
        }
        
        // 2. TOUCH-OPTIMIZED CONTROLS
        // --------------------------
        class TouchControls {
            constructor() {
                this.initializeControls();
            }
        
            initializeControls() {
                // Transform existing sliders into touch-friendly versions
                const sliders = document.querySelectorAll('.adjustment-slider');
                sliders.forEach(slider => {
                    this.createTouchFriendlySlider(slider);
                });
        
                // Add gesture recognition for image manipulation
                this.setupImageGestures();
            }
        
            createTouchFriendlySlider(originalSlider) {
                const touchSlider = document.createElement('div');
                touchSlider.className = 'touch-slider';
                touchSlider.innerHTML = `
                    <div class="touch-slider-track">
                        <div class="touch-slider-fill"></div>
                        <div class="touch-slider-handle"></div>
                    </div>
                    <div class="touch-slider-labels">
                        <span class="min">${originalSlider.min}</span>
                        <span class="max">${originalSlider.max}</span>
                    </div>
                `;
        
                this.setupSliderEvents(touchSlider, originalSlider);
                originalSlider.parentNode.replaceChild(touchSlider, originalSlider);
            }
        
            setupImageGestures() {
                const imageContainer = document.getElementById('image-container');
                let initialDistance = 0;
                let initialScale = 1;
        
                // Pinch to zoom
                imageContainer.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 2) {
                        initialDistance = Math.hypot(
                            e.touches[0].pageX - e.touches[1].pageX,
                            e.touches[0].pageY - e.touches[1].pageY
                        );
                        initialScale = imageSettings[currentEye].scale;
                    }
                });
        
                imageContainer.addEventListener('touchmove', (e) => {
                    if (e.touches.length === 2) {
                        const currentDistance = Math.hypot(
                            e.touches[0].pageX - e.touches[1].pageX,
                            e.touches[0].pageY - e.touches[1].pageY
                        );
                        const scale = (currentDistance / initialDistance) * initialScale;
                        updateTransform('scale', scale);
                    }
                });
            }
        }
        
        // 3. RESPONSIVE PANELS SYSTEM
        // --------------------------
        class ResponsivePanels {
            constructor() {
                this.panels = {
                    transform: this.createTransformPanel(),
                    adjustments: this.createAdjustmentsPanel(),
                    maps: this.createMapsPanel()
                };
                this.initializePanels();
            }
        
            createTransformPanel() {
                const panel = document.createElement('div');
                panel.className = 'mobile-panel panel-transform';
                panel.innerHTML = `
                    <div class="panel-header">
                        <h3>Transform</h3>
                        <button class="panel-close">×</button>
                    </div>
                    <div class="panel-content">
                        <!-- Transform controls -->
                    </div>
                `;
                return panel;
            }
        
            initializePanels() {
                Object.values(this.panels).forEach(panel => {
                    document.body.appendChild(panel);
                    this.setupPanelInteractions(panel);
                });
            }
        
            setupPanelInteractions(panel) {
                const header = panel.querySelector('.panel-header');
                let startY = 0;
                let currentY = 0;
        
                header.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    currentY = panel.getBoundingClientRect().top;
                });
        
                header.addEventListener('touchmove', (e) => {
                    const deltaY = e.touches[0].clientY - startY;
                    panel.style.transform = `translateY(${deltaY}px)`;
                });
        
                header.addEventListener('touchend', () => {
                    const finalPosition = panel.getBoundingClientRect().top;
                    if (finalPosition > window.innerHeight * 0.7) {
                        this.closePanel(panel);
                    } else {
                        this.snapPanelToPosition(panel);
                    }
                });
            }
        }
        
        // 4. Initialize Mobile Optimizations
        // --------------------------------
        document.addEventListener('DOMContentLoaded', function() {
            if (window.matchMedia('(max-width: 768px)').matches) {
                const mobileUI = new MobileUIManager();
                const touchControls = new TouchControls();
                const responsivePanels = new ResponsivePanels();
            }
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

        // Initialize gallery
        galleryAccordion.style.display = 'block';
        
    }

    // Start the application
    initialize();

    // Event Listeners for Image Upload
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
// Define movement function
function moveImage(direction) {
    const amount = 30;
    if (isDualViewActive) {
        ['L', 'R'].forEach(eye => {
            const settings = imageSettings[eye];
            if (!settings) return;
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
        if (!settings) return;
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
}

    // Setup movement controls in initialize function
    function initialize() {
        if (histogramCanvas) {
            histogramCanvas.width = histogramCanvas.offsetWidth || 300;
            histogramCanvas.height = histogramCanvas.offsetHeight || 150;
        }

        // Add this new section to your existing initialize function
        const moveUp = document.getElementById('moveUp');
        const moveDown = document.getElementById('moveDown');
        const moveLeft = document.getElementById('moveLeft');
        const moveRight = document.getElementById('moveRight');

        if (moveUp) moveUp.onclick = () => moveImage('up');
        if (moveDown) moveDown.onclick = () => moveImage('down');
        if (moveLeft) moveLeft.onclick = () => moveImage('left');
        if (moveRight) moveRight.onclick = () => moveImage('right');

        // Rest of your existing initialize code
        loadSVG(currentMap, 'L');
        loadSVG(currentMap, 'R');
        setupAdjustmentSliders();

        controls.forEach(control => {
            makeElementDraggable(control);
        });
            // Add transformation controls
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const rotateLeft = document.getElementById('rotateLeft');
    const rotateRight = document.getElementById('rotateRight');

    // Zoom In
    if(zoomIn) {
        zoomIn.onclick = () => {
            console.log('Zoom in clicked'); // Debug log
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
        };
    }

    // Zoom Out
    if(zoomOut) {
        zoomOut.onclick = () => {
            console.log('Zoom out clicked'); // Debug log
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
        };
    }

    // Rotate Left
    if(rotateLeft) {
        rotateLeft.onclick = () => {
            console.log('Rotate left clicked'); // Debug log
            if (isDualViewActive) {
                ['L', 'R'].forEach(eye => {
                    imageSettings[eye].rotation -= 5;
                    updateCanvasTransform(eye);
                });
            } else {
                imageSettings[currentEye].rotation -= 5;
                updateCanvasTransform(currentEye);
            }
        };
    }

    // Rotate Right
    if(rotateRight) {
        rotateRight.onclick = () => {
            console.log('Rotate right clicked'); // Debug log
            if (isDualViewActive) {
                ['L', 'R'].forEach(eye => {
                    imageSettings[eye].rotation += 5;
                    updateCanvasTransform(eye);
                });
            } else {
                imageSettings[currentEye].rotation += 5;
                updateCanvasTransform(currentEye);
            }
        };
    }
    }
    

    // Gallery Functions
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

        // Toggle gallery item content
        galleryItem.querySelector('.gallery-item-header').addEventListener('click', function() {
            const content = galleryItem.querySelector('.gallery-item-content');
            content.classList.toggle('active');
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
});

function autoLevels() {
    const settings = isDualViewActive ? ['L', 'R'] : [currentEye];

    settings.forEach(eye => {
        const adjustments = imageSettings[eye].adjustments;
        const canvas = imageSettings[eye].canvas;
        const ctx = imageSettings[eye].context;

        if (!canvas || !ctx) return;

        // Get image data from the canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Calculate luminance histogram
        const luminanceHistogram = new Uint32Array(256);
        for (let i = 0; i < data.length; i += 4) {
            const luminance = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            luminanceHistogram[luminance]++;
        }

        // Find cumulative distribution function (CDF)
        const totalPixels = canvas.width * canvas.height;
        const cdf = new Uint32Array(256);
        cdf[0] = luminanceHistogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + luminanceHistogram[i];
        }

        // Calculate lower and upper bounds (e.g., 1% and 99% percentiles)
        const lowerBound = totalPixels * 0.01;
        const upperBound = totalPixels * 0.99;

        let cdfMin = 0;
        let cdfMax = 255;

        for (let i = 0; i < 256; i++) {
            if (cdf[i] > lowerBound) {
                cdfMin = i;
                break;
            }
        }

        for (let i = 255; i >= 0; i--) {
            if (cdf[i] < upperBound) {
                cdfMax = i;
                break;
            }
        }

        // Calculate exposure and contrast adjustments
        const brightnessRange = cdfMax - cdfMin;
        const desiredRange = 220; // Target brightness range
        const contrastAdjustment = ((desiredRange / brightnessRange) - 1) * 100;
        const exposureAdjustment = ((128 - (cdfMin + cdfMax) / 2) / 128) * 100;

        adjustments.contrast = Math.max(-100, Math.min(100, contrastAdjustment));
        adjustments.exposure = Math.max(-100, Math.min(100, exposureAdjustment));

        // Update UI sliders
        if (adjustmentSliders.exposure) {
            adjustmentSliders.exposure.value = adjustments.exposure;
            adjustmentSliders.exposure.parentElement.querySelector('.adjustment-value').textContent = adjustments.exposure.toFixed(0);
        }

        if (adjustmentSliders.contrast) {
            adjustmentSliders.contrast.value = adjustments.contrast;
            adjustmentSliders.contrast.parentElement.querySelector('.adjustment-value').textContent = adjustments.contrast.toFixed(0);
        }

        // Apply adjustments
        updateCanvasImage(eye);
    });

    // Update histogram after auto levels
    setTimeout(updateHistogram, 100);
}



function applySharpness(ctx, amount) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const pixels = imageData.data;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Create temp array
    const temp = new Uint8ClampedArray(pixels.length);
    temp.set(pixels);

    // Normalized amount
    const strength = amount / 100;

    // Enhanced kernel for sharpening
    const kernel = [
        0, -1 * strength, 0,
        -1 * strength, 4 * strength + 1, -1 * strength,
        0, -1 * strength, 0
    ];

    // Apply convolution (optimized)
    convolve(temp, pixels, width, height, kernel);

    ctx.putImageData(imageData, 0, 0);
}

function convolve(src, dst, width, height, kernel) {
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);
    const alphaFac = 1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sy = y;
            let sx = x;
            let dstOff = (y * width + x) * 4;
            let r = 0, g = 0, b = 0, a = 0;

            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    let scy = sy + cy - halfSide;
                    let scx = sx + cx - halfSide;
                    if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                        let srcOff = (scy * width + scx) * 4;
                        let wt = kernel[cy * side + cx];

                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                        a += src[srcOff + 3] * wt;
                    }
                }
            }
            dst[dstOff] = Math.min(Math.max(r, 0), 255);
            dst[dstOff + 1] = Math.min(Math.max(g, 0), 255);
            dst[dstOff + 2] = Math.min(Math.max(b, 0), 255);
            dst[dstOff + 3] = Math.min(Math.max(a, 0), 255);
        }
    }
}



