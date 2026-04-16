const app = document.getElementById("birthdayApp");

if (app) {
  initBirthdayPlayer().catch((error) => {
    console.error("Failed to initialize birthday page", error);
  });
}

async function initBirthdayPlayer() {
  const slideCard = document.getElementById("slideCard");
  const continueButton = document.getElementById("continueButton");
  const emptyState = document.getElementById("emptyState");
  const audioButton = document.getElementById("audioToggle");
  const audio = document.getElementById("backgroundAudio");

  const response = await fetch(app.dataset.contentUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("Could not load content");
  }

  const payload = await response.json();
  const slides = Array.isArray(payload.slides) ? payload.slides : [];

  initAudio(audio, audioButton);

  if (!slides.length) {
    emptyState.classList.remove("hidden");
    slideCard.classList.add("hidden");
    return;
  }

  let currentIndex = 0;
  let activeToken = 0;
  let isTransitioning = false;

  continueButton.addEventListener("click", async () => {
    if (isTransitioning || currentIndex >= slides.length - 1) {
      return;
    }

    currentIndex += 1;
    await playSlide(currentIndex);
  });

  await playSlide(currentIndex, { isFirst: true });

  async function playSlide(index, options = {}) {
    const { isFirst = false } = options;
    const token = ++activeToken;
    isTransitioning = true;
    hideContinueButton(continueButton);

    if (!isFirst) {
      slideCard.classList.remove("transition-in");
      slideCard.classList.add("transition-out");
      await delay(340);
    }

    if (token !== activeToken) {
      return;
    }

    slideCard.className = "slide-card transition-in";
    slideCard.innerHTML = "";

    const slide = slides[index];
    const frame = buildSlideFrame(slide);
    slideCard.appendChild(frame.root);
    await delay(isFirst ? 320 : 520);

    await typeTextBlocks(frame.textLines, token, activeTokenRef);
    await revealImages(frame.imageScene, token, activeTokenRef);

    if (token !== activeToken) {
      return;
    }

    isTransitioning = false;
    if (index < slides.length - 1) {
      await delay((slide.continue_delay_seconds || 2) * 1000);
      if (token === activeToken) {
        showContinueButton(continueButton, slide.button_text || "Продолжить");
      }
    }
  }

  function activeTokenRef() {
    return activeToken;
  }
}

function buildSlideFrame(slide) {
  const root = document.createElement("div");
  root.className = "slide-inner";

  const layout = document.createElement("div");
  layout.className = `slide-layout layout-${slide.layout || "text-top"}`;

  const textStack = document.createElement("div");
  textStack.className = "text-stack";
  textStack.style.gap = `${resolveTextGap(slide.text_gap)}px`;

  const imageStack = document.createElement("div");
  imageStack.className = "image-stack";

  const textBlocks = (slide.text_blocks || []).filter((block) => block.content && block.content.trim());
  const textLines = textBlocks.map((block) => createPreparedTextLine(block));
  textLines.forEach((entry) => {
    textStack.appendChild(entry.root);
  });

  const imageScene = createImageScene(slide.image_blocks || []);
  if (imageScene) {
    imageStack.classList.add("has-images");
    imageStack.appendChild(imageScene.root);
  }

  layout.append(textStack, imageStack);
  root.appendChild(layout);

  return { root, textLines, imageScene };
}

function createPreparedTextLine(block) {
  const root = document.createElement("p");
  root.className = "typed-line";
  root.style.color = block.color || "#ffffff";
  root.style.textAlign = block.align || "center";
  root.style.fontSize = buildTextSize(block.font_size);

  const reserve = document.createElement("span");
  reserve.className = "typed-line-reserve";
  reserve.setAttribute("aria-hidden", "true");
  reserve.textContent = block.content.trim();

  const content = document.createElement("span");
  content.className = "typed-line-content";

  root.append(reserve, content);

  return { root, content, text: block.content.trim() };
}

async function typeTextBlocks(textLines, token, getActiveToken) {
  if (!textLines.length) {
    await delay(280);
    return;
  }

  for (const line of textLines) {
    if (token !== getActiveToken()) {
      return;
    }

    line.root.classList.add("visible", "typing");
    const speed = getTypingSpeed(line.text.length);
    for (let index = 1; index <= line.text.length; index += 1) {
      if (token !== getActiveToken()) {
        return;
      }
      line.content.textContent = line.text.slice(0, index);
      await delay(speed);
    }

    line.root.classList.remove("typing");
    await delay(420);
  }
}

function createImageScene(imageBlocks) {
  const validImages = imageBlocks.filter((item) => item.src);
  if (!validImages.length) {
    return null;
  }

  const useCarousel = validImages.length > 3;
  if (useCarousel) {
    const shell = document.createElement("div");
    shell.className = "carousel-shell";

    const track = document.createElement("div");
    track.className = "carousel-track";
    track.style.animationDuration = `${Math.max(18, validImages.length * 7)}s`;

    const items = [];
    const duplicated = [...validImages, ...validImages];
    duplicated.forEach((image, index) => {
      const item = document.createElement("div");
      item.className = "carousel-item";
      item.style.animationDelay = `${Math.min(index * 0.12, 1.2)}s`;
      item.appendChild(buildImageElement(image, true));
      track.appendChild(item);
      items.push(item);
    });

    shell.appendChild(track);
    return { root: shell, items, useCarousel: true };
  }

  const grid = document.createElement("div");
  grid.className = "image-grid";
  const items = validImages.map((image) => {
    const item = document.createElement("div");
    item.className = "image-grid-item";
    item.appendChild(buildImageElement(image, false));
    grid.appendChild(item);
    return item;
  });

  return { root: grid, items, useCarousel: false };
}

async function revealImages(imageScene, token, getActiveToken) {
  if (!imageScene) {
    return;
  }

  if (imageScene.useCarousel) {
    imageScene.items.forEach((item) => item.classList.add("visible"));
    await delay(900);
    return;
  }

  for (const [index, item] of imageScene.items.entries()) {
    if (token !== getActiveToken()) {
      return;
    }
    item.style.animationDelay = `${index * 0.15}s`;
    item.classList.add("visible");
    await delay(180);
  }
}

function buildImageElement(imageBlock, isCarousel) {
  const image = document.createElement("img");
  image.src = imageBlock.src;
  image.alt = imageBlock.alt || "";
  image.loading = "lazy";
  image.decoding = "async";
  image.style.maxHeight = `${imageBlock.max_height || 220}px`;
  image.style.width = buildImageWidth(imageBlock.width_percent, isCarousel);
  return image;
}

function buildTextSize(fontSize = 34) {
  const viewportValue = Math.max(4.1, fontSize / 8.5).toFixed(2);
  return `clamp(1rem, ${viewportValue}vw, ${fontSize}px)`;
}

function buildImageWidth(widthPercent = 28, isCarousel = false) {
  const maxPixels = Math.max(150, widthPercent * 7);
  const viewport = Math.max(18, widthPercent * (isCarousel ? 0.9 : 0.75)).toFixed(2);
  return `clamp(96px, ${viewport}vw, ${maxPixels}px)`;
}

function getTypingSpeed(length) {
  if (length > 220) {
    return 18;
  }
  if (length > 120) {
    return 24;
  }
  if (length > 70) {
    return 32;
  }
  return 40;
}

function showContinueButton(button, label) {
  window.clearTimeout(button.hideTimerId);
  const normalizedLabel = (label || "Продолжить").trim() || "Продолжить";
  button.textContent = normalizedLabel;
  button.classList.toggle("emoji-only", isEmojiOnlyLabel(normalizedLabel));
  button.classList.remove("hidden");
  requestAnimationFrame(() => {
    button.classList.add("visible");
  });
}

function hideContinueButton(button) {
  window.clearTimeout(button.hideTimerId);
  button.classList.remove("emoji-only");
  button.classList.remove("visible");
  button.hideTimerId = window.setTimeout(() => {
    button.classList.add("hidden");
  }, 180);
}

function initAudio(audio, button) {
  if (!audio || !button) {
    return;
  }

  button.classList.remove("hidden");
  updateAudioButton();

  const startPlayback = async () => {
    if (!audio.paused) {
      return;
    }
    try {
      await audio.play();
    } catch (error) {
      updateAudioButton(true);
      return;
    }
    updateAudioButton();
  };

  audio.addEventListener("play", updateAudioButton);
  audio.addEventListener("pause", updateAudioButton);

  button.addEventListener("click", async () => {
    if (audio.paused) {
      await startPlayback();
      return;
    }
    audio.pause();
  });

  document.addEventListener("pointerdown", startPlayback, { once: true });
  audio.play().then(() => updateAudioButton()).catch(() => updateAudioButton(true));

  function updateAudioButton(needsGesture = false) {
    if (audio.paused) {
      button.textContent = needsGesture ? "Включить музыку" : "Музыка";
      return;
    }
    button.textContent = "Пауза";
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resolveTextGap(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 12;
  }
  return Math.min(80, Math.max(0, parsed));
}

function isEmojiOnlyLabel(label) {
  const normalized = label.trim();
  if (!normalized) {
    return false;
  }

  const graphemes = splitGraphemes(normalized);
  if (graphemes.length !== 1) {
    return false;
  }

  return /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(normalized)
    || normalized.includes("\u200D")
    || normalized.includes("\uFE0F");
}

function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}
