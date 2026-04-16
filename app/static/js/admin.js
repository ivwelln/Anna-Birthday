const adminApp = document.getElementById("adminApp");

if (adminApp) {
  initAdmin().catch((error) => {
    console.error("Failed to initialize admin", error);
  });
}

async function initAdmin() {
  const slidesList = document.getElementById("slidesList");
  const slidesEmpty = document.getElementById("slidesEmpty");
  const slideTemplate = document.getElementById("slideTemplate");
  const addSlideButton = document.getElementById("addSlideButton");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");

  const state = {
    slides: [],
    isDirty: false,
    isSaving: false,
  };

  const response = await fetch(adminApp.dataset.contentUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Could not load content");
  }

  const payload = await response.json();
  state.slides = (payload.slides || []).map(normalizeSlide);
  renderSlides();
  setStatus("Можно редактировать слайды.", "idle");

  addSlideButton.addEventListener("click", () => {
    state.slides.push(createDefaultSlide());
    renderSlides();
    markDirty("Новый слайд добавлен.");
  });

  saveButton.addEventListener("click", async () => {
    if (state.isSaving) {
      return;
    }
    state.isSaving = true;
    saveButton.textContent = "Сохраняю...";
    setStatus("Сохраняю изменения...", "idle");

    try {
      const saveResponse = await fetch(adminApp.dataset.contentUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ slides: state.slides }),
      });
      if (!saveResponse.ok) {
        throw new Error("Save failed");
      }

      const savedPayload = await saveResponse.json();
      state.slides = (savedPayload.slides || []).map(normalizeSlide);
      state.isDirty = false;
      renderSlides();
      setStatus("Изменения сохранены.", "saved");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось сохранить изменения.", "error");
    } finally {
      state.isSaving = false;
      saveButton.textContent = "Сохранить всё";
    }
  });

  slidesList.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) {
      return;
    }

    const slideCard = target.closest("[data-slide-id]");
    if (!slideCard) {
      return;
    }
    const slideId = slideCard.dataset.slideId;
    const slideIndex = state.slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex < 0) {
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    if (action === "move-up" && slideIndex > 0) {
      swapItems(state.slides, slideIndex, slideIndex - 1);
      renderSlides();
      markDirty("Порядок слайдов изменён.");
      return;
    }

    if (action === "move-down" && slideIndex < state.slides.length - 1) {
      swapItems(state.slides, slideIndex, slideIndex + 1);
      renderSlides();
      markDirty("Порядок слайдов изменён.");
      return;
    }

    if (action === "delete-slide") {
      state.slides.splice(slideIndex, 1);
      renderSlides();
      markDirty("Слайд удалён.");
      return;
    }

    if (action === "add-text") {
      state.slides[slideIndex].text_blocks.push(createDefaultTextBlock());
      renderSlides();
      markDirty("Текстовый блок добавлен.");
      return;
    }

    if (action.startsWith("text-")) {
      handleTextAction(state.slides[slideIndex], target.dataset.textId, action);
      renderSlides();
      markDirty("Текстовый блок обновлён.");
      return;
    }

    if (action.startsWith("image-")) {
      handleImageAction(state.slides[slideIndex], target.dataset.imageId, action);
      renderSlides();
      markDirty("Изображение обновлено.");
    }
  });

  slidesList.addEventListener("input", (event) => {
    applyFieldMutation(event);
  });

  slidesList.addEventListener("change", async (event) => {
    if (applyFieldMutation(event)) {
      return;
    }

    const uploadInput = event.target;
    if (!uploadInput.matches('input[data-action="upload-images"]')) {
      return;
    }

    const slideCard = uploadInput.closest("[data-slide-id]");
    const slide = state.slides.find((item) => item.id === slideCard?.dataset.slideId);
    const files = Array.from(uploadInput.files || []);
    uploadInput.value = "";

    if (!slide || !files.length) {
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    setStatus("Загружаю изображения...", "idle");

    try {
      const uploadResponse = await fetch(adminApp.dataset.uploadUrl, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const payload = await uploadResponse.json();
      const uploadedItems = (payload.items || []).map(normalizeImageBlock);
      slide.image_blocks.push(...uploadedItems);
      renderSlides();
      markDirty("Изображения загружены.");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить изображения.", "error");
    }
  });

  function applyFieldMutation(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return false;
    }

    const slideCard = event.target.closest("[data-slide-id]");
    if (!slideCard) {
      return false;
    }

    const slide = state.slides.find((item) => item.id === slideCard.dataset.slideId);
    if (!slide) {
      return false;
    }

    if (!event.target.dataset.scope) {
      slide[field] = parseEditorValue(field, event.target.value);
      updatePreview(slideCard, slide);
      markDirty("Настройки слайда изменены.");
      return true;
    }

    const scope = event.target.dataset.scope;
    if (scope === "text") {
      const block = slide.text_blocks.find((item) => item.id === event.target.dataset.textId);
      if (!block) {
        return false;
      }
      block[field] = parseEditorValue(field, event.target.value);
      updatePreview(slideCard, slide);
      markDirty("Текст обновлён.");
      return true;
    }

    if (scope === "image") {
      const block = slide.image_blocks.find((item) => item.id === event.target.dataset.imageId);
      if (!block) {
        return false;
      }
      block[field] = parseEditorValue(field, event.target.value);
      updatePreview(slideCard, slide);
      markDirty("Настройки изображения обновлены.");
      return true;
    }

    return false;
  }

  window.addEventListener("beforeunload", (event) => {
    if (!state.isDirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });

  function renderSlides() {
    slidesList.innerHTML = "";

    if (!state.slides.length) {
      slidesEmpty.classList.remove("hidden");
      return;
    }

    slidesEmpty.classList.add("hidden");

    state.slides.forEach((slide, index) => {
      const fragment = slideTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".slide-editor-card");
      card.dataset.slideId = slide.id;

      fragment.querySelector(".slide-label").textContent = `Слайд ${index + 1}`;

      const buttonInput = fragment.querySelector('[data-field="button_text"]');
      buttonInput.value = slide.button_text;

      const delaySelect = fragment.querySelector('[data-field="continue_delay_seconds"]');
      delaySelect.value = String(slide.continue_delay_seconds);

      const textGapInput = fragment.querySelector('[data-field="text_gap"]');
      textGapInput.value = String(slide.text_gap);

      const layoutSelect = fragment.querySelector('[data-field="layout"]');
      layoutSelect.value = slide.layout;

      const textList = fragment.querySelector('[data-role="text-list"]');
      slide.text_blocks.forEach((block, blockIndex) => {
        textList.appendChild(renderTextBlock(block, blockIndex));
      });

      const imageList = fragment.querySelector('[data-role="image-list"]');
      slide.image_blocks.forEach((block, blockIndex) => {
        imageList.appendChild(renderImageBlock(block, blockIndex));
      });

      updatePreview(fragment, slide);
      slidesList.appendChild(fragment);
    });
  }

  function updatePreview(container, slide) {
    const previewRoot = container.querySelector('[data-role="preview"]');
    if (!previewRoot) {
      return;
    }

    previewRoot.innerHTML = "";
    const canvas = document.createElement("div");
    canvas.className = "preview-canvas";

    const layout = document.createElement("div");
    layout.className = `preview-layout layout-${slide.layout}`;

    const texts = document.createElement("div");
    texts.className = "preview-texts";
    texts.style.gap = `${slide.text_gap}px`;
    const visibleTexts = slide.text_blocks.filter((item) => item.content && item.content.trim());

    if (!visibleTexts.length) {
      const placeholder = document.createElement("p");
      placeholder.className = "preview-line";
      placeholder.textContent = "Добавь текст";
      placeholder.style.color = "rgba(248, 245, 239, 0.45)";
      texts.appendChild(placeholder);
    } else {
      visibleTexts.slice(0, 5).forEach((item) => {
        const line = document.createElement("p");
        line.className = "preview-line";
        line.textContent = item.content;
        line.style.color = item.color;
        line.style.textAlign = item.align;
        line.style.fontSize = `clamp(0.9rem, ${Math.max(0.9, item.font_size / 42).toFixed(2)}rem, 1.4rem)`;
        texts.appendChild(line);
      });
    }

    const images = document.createElement("div");
    images.className = "preview-images";
    slide.image_blocks.slice(0, 4).forEach((item) => {
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt || "";
      image.style.width = `${Math.max(22, Math.min(item.width_percent, 48))}%`;
      image.style.maxHeight = `${Math.min(item.max_height, 90)}px`;
      images.appendChild(image);
    });

    if (!slide.image_blocks.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "preview-line";
      placeholder.textContent = "Добавь фото";
      placeholder.style.color = "rgba(248, 245, 239, 0.45)";
      images.appendChild(placeholder);
    }

    layout.append(texts, images);
    canvas.appendChild(layout);
    previewRoot.appendChild(canvas);
  }

  function markDirty(message) {
    state.isDirty = true;
    setStatus(message || "Есть несохранённые изменения.", "idle");
  }

  function setStatus(message, tone) {
    statusMessage.textContent = message;
    statusMessage.dataset.state = tone;
  }
}

function renderTextBlock(block, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-item";

  const toolbar = document.createElement("div");
  toolbar.className = "text-toolbar";
  toolbar.innerHTML = `
    <strong>Текст ${index + 1}</strong>
    <div class="slide-editor-actions">
      <button class="ghost-button small-button" type="button" data-action="text-up" data-text-id="${block.id}">Выше</button>
      <button class="ghost-button small-button" type="button" data-action="text-down" data-text-id="${block.id}">Ниже</button>
      <button class="danger-button small-button" type="button" data-action="text-delete" data-text-id="${block.id}">Удалить</button>
    </div>
  `;

  const fieldGroup = document.createElement("div");
  fieldGroup.className = "field-group";
  fieldGroup.innerHTML = "<label>Содержимое</label>";
  const textarea = document.createElement("textarea");
  textarea.dataset.scope = "text";
  textarea.dataset.textId = block.id;
  textarea.dataset.field = "content";
  textarea.value = block.content;
  fieldGroup.appendChild(textarea);

  const grid = document.createElement("div");
  grid.className = "inline-grid two-columns";
  grid.append(
    createNumberField("Размер текста", "font_size", block.font_size, block.id, "text", 16, 96),
    createColorField("Цвет текста", "color", block.color, block.id, "text"),
    createSelectField("Выравнивание", "align", block.align, block.id, "text", [
      { value: "left", label: "Слева" },
      { value: "center", label: "По центру" },
      { value: "right", label: "Справа" },
    ]),
    createNumberField("Задержка перед текстом (сек)", "delay_seconds", block.delay_seconds, block.id, "text", 0, 10, 0.1),
  );

  wrapper.append(toolbar, fieldGroup, grid);
  return wrapper;
}

function renderImageBlock(block, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "image-item";

  const toolbar = document.createElement("div");
  toolbar.className = "image-toolbar";
  toolbar.innerHTML = `
    <strong>Изображение ${index + 1}</strong>
    <div class="slide-editor-actions">
      <button class="ghost-button small-button" type="button" data-action="image-left" data-image-id="${block.id}">Левее</button>
      <button class="ghost-button small-button" type="button" data-action="image-right" data-image-id="${block.id}">Правее</button>
      <button class="danger-button small-button" type="button" data-action="image-delete" data-image-id="${block.id}">Удалить</button>
    </div>
  `;

  const image = document.createElement("img");
  image.className = "image-thumb";
  image.src = block.src;
  image.alt = block.alt || "";

  const grid = document.createElement("div");
  grid.className = "inline-grid two-columns";
  grid.append(
    createTextField("Подпись / alt", "alt", block.alt, block.id, "image"),
    createNumberField("Ширина (%)", "width_percent", block.width_percent, block.id, "image", 12, 100),
    createNumberField("Макс. высота (px)", "max_height", block.max_height, block.id, "image", 80, 420),
    createTextField("Путь к файлу", "src", block.src, block.id, "image", true),
  );

  wrapper.append(toolbar, image, grid);
  return wrapper;
}

function createTextField(labelText, field, value, itemId, scope, readOnly = false) {
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "field-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  fieldGroup.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.field = field;
  input.dataset.scope = scope;
  if (scope === "text") {
    input.dataset.textId = itemId;
  } else {
    input.dataset.imageId = itemId;
  }
  input.readOnly = readOnly;
  fieldGroup.appendChild(input);

  return fieldGroup;
}

function createNumberField(labelText, field, value, itemId, scope, min, max, step = 1) {
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "field-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  fieldGroup.appendChild(label);

  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.dataset.field = field;
  input.dataset.scope = scope;
  if (scope === "text") {
    input.dataset.textId = itemId;
  } else {
    input.dataset.imageId = itemId;
  }
  fieldGroup.appendChild(input);

  return fieldGroup;
}

function createColorField(labelText, field, value, itemId, scope) {
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "field-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  fieldGroup.appendChild(label);

  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.dataset.field = field;
  input.dataset.scope = scope;
  input.dataset.textId = itemId;
  fieldGroup.appendChild(input);

  return fieldGroup;
}

function createSelectField(labelText, field, value, itemId, scope, options) {
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "field-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  fieldGroup.appendChild(label);

  const select = document.createElement("select");
  select.dataset.field = field;
  select.dataset.scope = scope;
  select.dataset.textId = itemId;
  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === value;
    select.appendChild(optionElement);
  });

  fieldGroup.appendChild(select);
  return fieldGroup;
}

function handleTextAction(slide, textId, action) {
  const index = slide.text_blocks.findIndex((item) => item.id === textId);
  if (index < 0) {
    return;
  }
  if (action === "text-up" && index > 0) {
    swapItems(slide.text_blocks, index, index - 1);
  }
  if (action === "text-down" && index < slide.text_blocks.length - 1) {
    swapItems(slide.text_blocks, index, index + 1);
  }
  if (action === "text-delete") {
    slide.text_blocks.splice(index, 1);
  }
}

function handleImageAction(slide, imageId, action) {
  const index = slide.image_blocks.findIndex((item) => item.id === imageId);
  if (index < 0) {
    return;
  }
  if (action === "image-left" && index > 0) {
    swapItems(slide.image_blocks, index, index - 1);
  }
  if (action === "image-right" && index < slide.image_blocks.length - 1) {
    swapItems(slide.image_blocks, index, index + 1);
  }
  if (action === "image-delete") {
    slide.image_blocks.splice(index, 1);
  }
}

function swapItems(items, fromIndex, toIndex) {
  const [item] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, item);
}

function parseEditorValue(field, value) {
  if (
    field === "font_size"
    || field === "width_percent"
    || field === "max_height"
    || field === "continue_delay_seconds"
    || field === "text_gap"
    || field === "delay_seconds"
  ) {
    if (field === "font_size") {
      return clampNumber(value, 16, 96, 34);
    }
    if (field === "width_percent") {
      return clampNumber(value, 12, 100, 28);
    }
    if (field === "continue_delay_seconds") {
      return clampNumber(value, 1, 3, 2);
    }
    if (field === "text_gap") {
      return clampNumber(value, 0, 80, 12);
    }
    if (field === "delay_seconds") {
      return clampDecimal(value, 0, 10, 0, 1);
    }
    return clampNumber(value, 80, 420, 220);
  }
  return value;
}

function normalizeSlide(slide) {
  return {
    id: slide.id || makeId(),
    button_text: slide.button_text || "Продолжить",
    continue_delay_seconds: clampNumber(slide.continue_delay_seconds, 1, 3, 2),
    layout: slide.layout || "text-top",
    text_gap: clampNumber(slide.text_gap, 0, 80, 12),
    text_blocks: Array.isArray(slide.text_blocks) ? slide.text_blocks.map(normalizeTextBlock) : [],
    image_blocks: Array.isArray(slide.image_blocks) ? slide.image_blocks.map(normalizeImageBlock) : [],
  };
}

function normalizeTextBlock(block) {
  return {
    id: block.id || makeId(),
    content: block.content || "",
    color: block.color || "#ffffff",
    font_size: Number(block.font_size) || 34,
    align: block.align || "center",
    delay_seconds: clampDecimal(block.delay_seconds, 0, 10, 0, 1),
  };
}

function normalizeImageBlock(block) {
  return {
    id: block.id || makeId(),
    src: block.src || "",
    alt: block.alt || "",
    width_percent: Number(block.width_percent) || 28,
    max_height: Number(block.max_height) || 220,
  };
}

function createDefaultSlide() {
  return {
    id: makeId(),
    button_text: "Продолжить",
    continue_delay_seconds: 2,
    layout: "text-top",
    text_gap: 12,
    text_blocks: [createDefaultTextBlock()],
    image_blocks: [],
  };
}

function createDefaultTextBlock() {
  return {
    id: makeId(),
    content: "Новый текст",
    color: "#ffffff",
    font_size: 34,
    align: "center",
    delay_seconds: 0,
  };
}

function makeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replaceAll("-", "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function clampDecimal(value, min, max, fallback, precision = 1) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  const factor = 10 ** precision;
  const clamped = Math.min(max, Math.max(min, parsed));
  return Math.round(clamped * factor) / factor;
}
