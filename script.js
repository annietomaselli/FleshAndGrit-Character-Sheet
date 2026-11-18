// Estado da Aplicação
let characters = JSON.parse(localStorage.getItem('flesh_and_grit_chars')) || [];
let activeCharId = null;
let editingCharId = null;

// Modais
let adjustTarget = { category: null, key: null, mode: null };
let activeAttrKey = null;
let activeReaderElement = null;

const INTEGRITY_OPTIONS = [
  'Ok',
  'Levemente danificado',
  'Moderadamente danificado',
  'Gravemente danificado',
  'Inutilizado'
];

const BODY_PARTS = [
  'Cabeça',
  'Tórax',
  'Braço Esq',
  'Braço Dir',
  'Perna Esq',
  'Perna Dir'
];

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230e1c16'/><circle cx='50' cy='38' r='18' fill='%236d8581'/><path d='M20 88 C20 65, 80 65, 80 88' fill='%236d8581'/></svg>";

const homeView = document.getElementById('home-view');
const sheetView = document.getElementById('sheet-view');
const charGrid = document.getElementById('character-grid');
const emptyState = document.getElementById('empty-state');
const charModal = document.getElementById('char-modal');
const adjustModal = document.getElementById('adjust-modal');
const attrModal = document.getElementById('attr-modal');
const readerModal = document.getElementById('reader-modal');
const actionDetailModal = document.getElementById('action-detail-modal');
const pasteJsonModal = document.getElementById('paste-json-modal');

// ================= NORMALIZAÇÃO DE DADOS =================
function normalizeCharacter(c) {
  if (!c) return null;
  c.name = c.name || 'Sobrevivente';
  c.photo = c.photo || DEFAULT_AVATAR;
  c.borderColor = c.borderColor || '#c03e3e';
  c.area = c.area || '';
  c.specialty = c.specialty || '';
  c.desl = Number(c.desl) || 0;
  c.sorte = Number(c.sorte) || 0;
  c.clamor = Number(c.clamor) || 0;
  c.bodyWeight = Number(c.bodyWeight) || 70;

  c.attributes = {
    FOR: 1, AGI: 1, TEN: 1, SEN: 1, INT: 1, EMO: 1, MEN: 1,
    ...(c.attributes || {})
  };

  if (!c.tempAttributes || typeof c.tempAttributes !== 'object') {
    c.tempAttributes = {};
  }

  c.vitals = {
    pvs: { cur: 10, max: 10, ...(c.vitals?.pvs || {}) },
    pss: { cur: 10, max: 10, ...(c.vitals?.pss || {}) },
    pes: { cur: 10, max: 10, ...(c.vitals?.pes || {}) },
    pfs: { cur: 10, max: 10, ...(c.vitals?.pfs || {}) }
  };

  if (!c.integrity || typeof c.integrity !== 'object') {
    c.integrity = {};
  }
  BODY_PARTS.forEach(part => {
    const val = c.integrity[part];
    if (!val || typeof val === 'string') {
      const matchedStatus = INTEGRITY_OPTIONS.includes(val) ? val : 'Ok';
      c.integrity[part] = { status: matchedStatus, desc: (val && val !== 'OK' && val !== 'Ok') ? val : '' };
    } else {
      c.integrity[part] = {
        status: val.status || 'Ok',
        desc: val.desc || ''
      };
    }
  });

  const defaultNut = { cur: 10, max: 10 };
  c.nutrients = {
    'Proteínas': { ...defaultNut, ...(c.nutrients?.['Proteínas'] || {}) },
    'Gorduras': { ...defaultNut, ...(c.nutrients?.['Gorduras'] || {}) },
    'Carboidratos': { ...defaultNut, ...(c.nutrients?.['Carboidratos'] || {}) },
    'Hidratação': { ...defaultNut, ...(c.nutrients?.['Hidratação'] || {}) }
  };

  if (!Array.isArray(c.actionsList)) c.actionsList = [];
  c.actionsList = c.actionsList.map(act => ({
    type: 'Ação',
    cost: '',
    dmg: '',
    desc: '',
    ...act
  }));

  if (!Array.isArray(c.skills)) c.skills = [];
  if (!Array.isArray(c.inventory)) c.inventory = [];

  c.equipment = {
    armor: { name: '', prot: '', tier: '', ...(c.equipment?.armor || {}) },
    left: { name: '', dmg: '', type: '', tier: '', ...(c.equipment?.left || {}) },
    right: { name: '', dmg: '', type: '', tier: '', ...(c.equipment?.right || {}) }
  };

  return c;
}

// ================= INICIALIZAÇÃO & TEMA =================
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('fg_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  characters = characters.map(normalizeCharacter);
  saveToStorage();
  renderCharacterList();
  initExpandableTextareas();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('fg_theme', next);
});

function saveToStorage() {
  localStorage.setItem('flesh_and_grit_chars', JSON.stringify(characters));
}

// ================= IMPORTAR JSON POR TEXTO (COLA) =================
const btnOpenPasteModal = document.getElementById('btn-open-paste-modal');
const btnClosePasteModal = document.getElementById('btn-close-paste-modal');
const btnCancelPaste = document.getElementById('btn-cancel-paste');
const btnConfirmPaste = document.getElementById('btn-confirm-paste');
const pasteJsonTextarea = document.getElementById('paste-json-textarea');

btnOpenPasteModal.addEventListener('click', () => {
  pasteJsonTextarea.value = '';
  pasteJsonModal.classList.remove('hidden');
  pasteJsonTextarea.focus();
});

function closePasteModal() {
  pasteJsonModal.classList.add('hidden');
  pasteJsonTextarea.value = '';
}

btnClosePasteModal.addEventListener('click', closePasteModal);
btnCancelPaste.addEventListener('click', closePasteModal);

btnConfirmPaste.addEventListener('click', () => {
  const rawText = pasteJsonTextarea.value.trim();
  if (!rawText) {
    alert('Por favor, cole o código JSON na caixa de texto.');
    return;
  }

  try {
    const imported = JSON.parse(rawText);
    if (!imported.name || !imported.attributes) {
      alert('O JSON informado não é uma ficha válida para Flesh & Grit.');
      return;
    }
    imported.id = Date.now().toString();
    characters.push(normalizeCharacter(imported));
    saveToStorage();
    renderCharacterList();
    closePasteModal();
    alert(`Sobrevivente "${imported.name}" importado com sucesso.`);
  } catch (err) {
    alert('Erro ao interpretar o JSON. Verifique se o formato do texto está correto.');
  }
});

// ================= VISUALIZAÇÃO EXPANDIDA DE AÇÃO =================
function openActionDetailModal(act) {
  document.getElementById('detail-act-title').textContent = act.name;
  const tagsEl = document.getElementById('detail-act-tags');
  tagsEl.innerHTML = `<span class="action-tag">Tipo: ${act.type || 'Ação'}</span>`;
  if (act.cost) tagsEl.innerHTML += `<span class="action-tag">Custo: ${act.cost}</span>`;
  if (act.dmg) tagsEl.innerHTML += `<span class="action-tag">Dano: ${act.dmg}</span>`;

  const descEl = document.getElementById('detail-act-desc');
  descEl.textContent = act.desc ? act.desc : 'Sem descrição adicional registrada para esta ação.';

  actionDetailModal.classList.remove('hidden');
}

function closeActionDetailModal() {
  actionDetailModal.classList.add('hidden');
}

document.getElementById('btn-close-action-detail').addEventListener('click', closeActionDetailModal);
document.getElementById('btn-ok-action-detail').addEventListener('click', closeActionDetailModal);

// ================= LEITURA AMPLIADA DE TEXTOS GRANDES =================
function initExpandableTextareas() {
  document.querySelectorAll('.expandable-textarea').forEach(textarea => {
    if (textarea.dataset.bound === 'true') return;
    textarea.dataset.bound = 'true';
    textarea.addEventListener('click', () => {
      openReaderModal(textarea);
    });
  });
}

function openReaderModal(textareaEl) {
  activeReaderElement = textareaEl;
  const cardTitle = textareaEl.closest('.card')?.querySelector('.section-title')?.textContent?.replace('(Toque p/ ampliar)', '').trim() || 'Visualizar Texto';
  document.getElementById('reader-modal-title').textContent = cardTitle;
  document.getElementById('reader-textarea').value = textareaEl.value;
  readerModal.classList.remove('hidden');
}

document.getElementById('btn-close-reader').addEventListener('click', () => {
  readerModal.classList.add('hidden');
  activeReaderElement = null;
});

document.getElementById('btn-save-reader').addEventListener('click', () => {
  if (activeReaderElement) {
    activeReaderElement.value = document.getElementById('reader-textarea').value;
    activeReaderElement.dispatchEvent(new Event('input'));
  }
  readerModal.classList.add('hidden');
  activeReaderElement = null;
});

// ================= LISTA INICIAL =================
function renderCharacterList() {
  charGrid.innerHTML = '';
  if (characters.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  characters.forEach(rawChar => {
    const char = normalizeCharacter(rawChar);
    const card = document.createElement('div');
    card.className = 'char-card';
    card.innerHTML = `
      <img src="${char.photo}" alt="${char.name}" style="border-color: ${char.borderColor}; box-shadow: 0 0 12px ${char.borderColor}66;">
      <div class="char-card-info">
        <h3>${char.name}</h3>
        <p>${char.specialty || char.area || 'Sobrevivente'}</p>
        <p style="margin-top:4px; font-size:0.78rem;">
          PV: ${char.vitals.pvs.cur}/${char.vitals.pvs.max} | 
          PS: ${char.vitals.pss.cur}/${char.vitals.pss.max}
        </p>
      </div>
      <button type="button" class="delete-char-btn" title="Excluir">X</button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-char-btn')) {
        e.stopPropagation();
        deleteCharacter(char.id);
        return;
      }
      openCharacterSheet(char.id);
    });

    charGrid.appendChild(card);
  });
}

function deleteCharacter(id) {
  if (!confirm('Tem certeza que deseja apagar este sobrevivente permanentemente?')) return;
  characters = characters.filter(c => c.id !== id);
  saveToStorage();
  renderCharacterList();
}

// ================= MODAL CRIAR / EDITAR FICHA =================
document.getElementById('btn-new-char').addEventListener('click', () => openModal(null));
document.getElementById('btn-edit-char').addEventListener('click', () => {
  if (!activeCharId) return;
  openModal(activeCharId);
});
document.getElementById('btn-close-modal').addEventListener('click', closeModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

function openModal(charId = null) {
  try {
    editingCharId = charId;
    const form = document.getElementById('char-form');
    form.reset();

    if (charId) {
      const raw = characters.find(x => x.id === charId);
      if (!raw) throw new Error('Personagem não encontrado');
      const c = normalizeCharacter(raw);

      document.getElementById('modal-title').textContent = 'Editar Sobrevivente';
      document.getElementById('inp-name').value = c.name;
      document.getElementById('inp-border-color').value = c.borderColor;
      document.getElementById('inp-area').value = c.area;
      document.getElementById('inp-specialty').value = c.specialty;

      document.getElementById('inp-for').value = c.attributes.FOR;
      document.getElementById('inp-agi').value = c.attributes.AGI;
      document.getElementById('inp-ten').value = c.attributes.TEN;
      document.getElementById('inp-sen').value = c.attributes.SEN;
      document.getElementById('inp-int').value = c.attributes.INT;
      document.getElementById('inp-emo').value = c.attributes.EMO;
      document.getElementById('inp-men').value = c.attributes.MEN;

      document.getElementById('inp-pvs').value = c.vitals.pvs.max;
      document.getElementById('inp-pss').value = c.vitals.pss.max;
      document.getElementById('inp-pes').value = c.vitals.pes.max;
      document.getElementById('inp-pfs').value = c.vitals.pfs.max;

      document.getElementById('inp-desl').value = c.desl;
      document.getElementById('inp-sorte').value = c.sorte;
      document.getElementById('inp-clamor').value = c.clamor;
      document.getElementById('inp-bodyweight').value = c.bodyWeight;

      document.getElementById('inp-nut-prot').value = c.nutrients['Proteínas'].max;
      document.getElementById('inp-nut-gord').value = c.nutrients['Gorduras'].max;
      document.getElementById('inp-nut-carb').value = c.nutrients['Carboidratos'].max;
      document.getElementById('inp-nut-hidr').value = c.nutrients['Hidratação'].max;
    } else {
      document.getElementById('modal-title').textContent = 'Novo Sobrevivente';
      document.getElementById('inp-border-color').value = '#c03e3e';
    }

    charModal.classList.remove('hidden');
  } catch (err) {
    console.error('Erro ao abrir modal de edição:', err);
    closeModal();
  }
}

function closeModal() {
  charModal.classList.add('hidden');
  editingCharId = null;
}

function processImageFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 220;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } }
        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

document.getElementById('char-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const photoFile = document.getElementById('inp-photo').files[0];
    const photoBase64 = await processImageFile(photoFile);

    const pvsMax = Number(document.getElementById('inp-pvs').value) || 0;
    const pssMax = Number(document.getElementById('inp-pss').value) || 0;
    const pesMax = Number(document.getElementById('inp-pes').value) || 0;
    const pfsMax = Number(document.getElementById('inp-pfs').value) || 0;

    const nutProtMax = Number(document.getElementById('inp-nut-prot').value) || 0;
    const nutGordMax = Number(document.getElementById('inp-nut-gord').value) || 0;
    const nutCarbMax = Number(document.getElementById('inp-nut-carb').value) || 0;
    const nutHidrMax = Number(document.getElementById('inp-nut-hidr').value) || 0;

    const attrs = {
      FOR: Number(document.getElementById('inp-for').value) || 0,
      AGI: Number(document.getElementById('inp-agi').value) || 0,
      TEN: Number(document.getElementById('inp-ten').value) || 0,
      SEN: Number(document.getElementById('inp-sen').value) || 0,
      INT: Number(document.getElementById('inp-int').value) || 0,
      EMO: Number(document.getElementById('inp-emo').value) || 0,
      MEN: Number(document.getElementById('inp-men').value) || 0,
    };

    if (editingCharId) {
      const idx = characters.findIndex(c => c.id === editingCharId);
      if (idx !== -1) {
        const old = normalizeCharacter(characters[idx]);
        const targetId = editingCharId;

        characters[idx] = {
          ...old,
          name: document.getElementById('inp-name').value.trim(),
          photo: photoBase64 || old.photo,
          borderColor: document.getElementById('inp-border-color').value,
          area: document.getElementById('inp-area').value.trim(),
          specialty: document.getElementById('inp-specialty').value.trim(),
          attributes: attrs,
          vitals: {
            pvs: { cur: Math.min(old.vitals.pvs.cur, pvsMax), max: pvsMax },
            pss: { cur: Math.min(old.vitals.pss.cur, pssMax), max: pssMax },
            pes: { cur: Math.min(old.vitals.pes.cur, pesMax), max: pesMax },
            pfs: { cur: Math.min(old.vitals.pfs.cur, pfsMax), max: pfsMax },
          },
          nutrients: {
            'Proteínas': { cur: Math.min(old.nutrients['Proteínas'].cur, nutProtMax), max: nutProtMax },
            'Gorduras': { cur: Math.min(old.nutrients['Gorduras'].cur, nutGordMax), max: nutGordMax },
            'Carboidratos': { cur: Math.min(old.nutrients['Carboidratos'].cur, nutCarbMax), max: nutCarbMax },
            'Hidratação': { cur: Math.min(old.nutrients['Hidratação'].cur, nutHidrMax), max: nutHidrMax }
          },
          desl: Number(document.getElementById('inp-desl').value) || 0,
          sorte: Number(document.getElementById('inp-sorte').value) || 0,
          clamor: Number(document.getElementById('inp-clamor').value) || 0,
          bodyWeight: Number(document.getElementById('inp-bodyweight').value) || 70,
        };
        saveToStorage();
        closeModal();
        openCharacterSheet(targetId);
      } else {
        closeModal();
      }
    } else {
      const newChar = normalizeCharacter({
        id: Date.now().toString(),
        name: document.getElementById('inp-name').value.trim(),
        photo: photoBase64 || DEFAULT_AVATAR,
        borderColor: document.getElementById('inp-border-color').value,
        area: document.getElementById('inp-area').value.trim(),
        specialty: document.getElementById('inp-specialty').value.trim(),
        attributes: attrs,
        vitals: {
          pvs: { cur: pvsMax, max: pvsMax },
          pss: { cur: pssMax, max: pssMax },
          pes: { cur: pesMax, max: pesMax },
          pfs: { cur: pfsMax, max: pfsMax },
        },
        desl: Number(document.getElementById('inp-desl').value) || 0,
        sorte: Number(document.getElementById('inp-sorte').value) || 0,
        clamor: Number(document.getElementById('inp-clamor').value) || 0,
        bodyWeight: Number(document.getElementById('inp-bodyweight').value) || 70,
        nutrients: {
          'Proteínas': { cur: nutProtMax, max: nutProtMax },
          'Gorduras': { cur: nutGordMax, max: nutGordMax },
          'Carboidratos': { cur: nutCarbMax, max: nutCarbMax },
          'Hidratação': { cur: nutHidrMax, max: nutHidrMax }
        }
      });
      characters.push(newChar);
      saveToStorage();
      closeModal();
      renderCharacterList();
    }
  } catch (err) {
    console.error('Erro ao salvar personagem:', err);
    closeModal();
  }
});

// ================= TELA DA FICHA DO PERSONAGEM =================
function getActiveChar() {
  const c = characters.find(x => x.id === activeCharId);
  return c ? normalizeCharacter(c) : null;
}

function openCharacterSheet(id) {
  activeCharId = id;
  homeView.classList.add('hidden');
  sheetView.classList.remove('hidden');
  renderSheet();
}

document.getElementById('btn-back').addEventListener('click', () => {
  activeCharId = null;
  sheetView.classList.add('hidden');
  homeView.classList.remove('hidden');
  renderCharacterList();
});

// Controle das Abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
  });
});

// Botões Sorte e Clamor
document.getElementById('btn-sorte-dec').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;
  c.sorte = Math.max(0, c.sorte - 1);
  saveToStorage();
  renderSheet();
});
document.getElementById('btn-sorte-inc').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;
  c.sorte += 1;
  saveToStorage();
  renderSheet();
});
document.getElementById('btn-clamor-dec').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;
  c.clamor = Math.max(0, c.clamor - 1);
  saveToStorage();
  renderSheet();
});
document.getElementById('btn-clamor-inc').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;
  c.clamor += 1;
  saveToStorage();
  renderSheet();
});

// ================= ALTERAÇÃO TEMPORÁRIA DE ATRIBUTOS =================
function openAttrModal(attrKey) {
  const c = getActiveChar();
  if (!c) return;
  activeAttrKey = attrKey;

  const baseVal = c.attributes[attrKey];
  const curVal = c.tempAttributes[attrKey] !== undefined ? c.tempAttributes[attrKey] : baseVal;

  document.getElementById('attr-modal-title').textContent = `Atributo: ${attrKey}`;
  document.getElementById('attr-modal-desc').textContent = `Valor base original: ${baseVal}. Defina um valor temporário para bônus ou penalidades.`;
  const input = document.getElementById('attr-new-val');
  input.value = curVal;

  attrModal.classList.remove('hidden');
  input.focus();
  input.select();
}

function closeAttrModal() {
  attrModal.classList.add('hidden');
  activeAttrKey = null;
}

document.getElementById('btn-close-attr').addEventListener('click', closeAttrModal);
document.getElementById('btn-cancel-attr').addEventListener('click', closeAttrModal);

document.getElementById('btn-reset-attr').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c || !activeAttrKey) return;
  delete c.tempAttributes[activeAttrKey];
  saveToStorage();
  closeAttrModal();
  renderSheet();
});

document.getElementById('attr-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = getActiveChar();
  if (!c || !activeAttrKey) return;

  const newVal = Number(document.getElementById('attr-new-val').value);
  if (newVal === c.attributes[activeAttrKey]) {
    delete c.tempAttributes[activeAttrKey];
  } else {
    c.tempAttributes[activeAttrKey] = newVal;
  }

  saveToStorage();
  closeAttrModal();
  renderSheet();
});

// ================= MODAL DE AJUSTE NUMÉRICO (VIDA & NUTRIENTES) =================
function openAdjustModal(category, key, mode, label) {
  adjustTarget = { category, key, mode };
  const isSub = mode === 'sub';
  const title = isSub ? `Reduzir — ${label}` : `Aumentar — ${label}`;
  const desc = isSub
    ? 'O valor digitado será subtraído do valor atual.'
    : 'O valor digitado será somado ao valor atual.';

  document.getElementById('adjust-modal-title').textContent = title;
  document.getElementById('adjust-modal-desc').textContent = desc;
  const input = document.getElementById('adjust-amount');
  input.value = 1;
  adjustModal.classList.remove('hidden');
  input.focus();
  input.select();
}

function closeAdjustModal() {
  adjustModal.classList.add('hidden');
  adjustTarget = { category: null, key: null, mode: null };
}

document.getElementById('btn-close-adjust').addEventListener('click', closeAdjustModal);
document.getElementById('btn-cancel-adjust').addEventListener('click', closeAdjustModal);

document.getElementById('adjust-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = getActiveChar();
  if (!c || !adjustTarget.key) {
    closeAdjustModal();
    return;
  }

  const amount = Math.abs(Number(document.getElementById('adjust-amount').value)) || 0;
  const targetObj = adjustTarget.category === 'vitals'
    ? c.vitals[adjustTarget.key]
    : c.nutrients[adjustTarget.key];

  if (targetObj) {
    if (adjustTarget.mode === 'sub') {
      targetObj.cur = Math.max(0, targetObj.cur - amount);
    } else {
      targetObj.cur = Math.min(targetObj.max, targetObj.cur + amount);
    }
  }

  saveToStorage();
  closeAdjustModal();
  renderSheet();
});

// ================= RENDERIZAÇÃO GERAL DA FICHA =================
function renderSheet() {
  const c = getActiveChar();
  if (!c) return;

  const avatarEl = document.getElementById('sheet-avatar');
  avatarEl.src = c.photo;
  avatarEl.style.borderColor = c.borderColor;
  avatarEl.style.boxShadow = `0 0 18px ${c.borderColor}99, 0 0 36px ${c.borderColor}44`;

  document.getElementById('sheet-name').textContent = c.name;
  const subText = [c.area, c.specialty].filter(Boolean).join(' • ') || 'Sobrevivente';
  document.getElementById('sheet-specialty').textContent = subText;
  document.getElementById('sheet-desl').textContent = c.desl;
  document.getElementById('sheet-sorte').textContent = c.sorte;
  document.getElementById('sheet-clamor').textContent = c.clamor;

  // Recursos Vitais
  const vitalsConfig = [
    { key: 'pvs', label: 'PVs (Vida)', subText: 'Dano', addText: 'Cura' },
    { key: 'pss', label: 'PSs (Sanidade)', subText: 'Perda', addText: 'Recuperar' },
    { key: 'pes', label: 'PEs (Energia)', subText: 'Gastar', addText: 'Recuperar' },
    { key: 'pfs', label: 'PFs (Fôlego)', subText: 'Gastar', addText: 'Recuperar' }
  ];

  const vitalsContainer = document.getElementById('vitals-container');
  vitalsContainer.innerHTML = '';

  vitalsConfig.forEach(item => {
    const v = c.vitals[item.key];
    const div = document.createElement('div');
    div.className = 'vital-box';
    div.innerHTML = `
      <label>${item.label}</label>
      <span class="vital-value">${v.cur} / ${v.max}</span>
      <div class="vital-actions">
        <button type="button" class="btn-damage">${item.subText}</button>
        <button type="button" class="btn-heal">${item.addText}</button>
      </div>
    `;
    div.querySelector('.btn-damage').addEventListener('click', () => {
      openAdjustModal('vitals', item.key, 'sub', item.label);
    });
    div.querySelector('.btn-heal').addEventListener('click', () => {
      openAdjustModal('vitals', item.key, 'add', item.label);
    });
    vitalsContainer.appendChild(div);
  });

  // Atributos
  const attrContainer = document.getElementById('attributes-container');
  attrContainer.innerHTML = '';
  Object.entries(c.attributes).forEach(([abbr, baseVal]) => {
    const hasTemp = c.tempAttributes && c.tempAttributes[abbr] !== undefined;
    const displayVal = hasTemp ? c.tempAttributes[abbr] : baseVal;
    const box = document.createElement('div');
    box.className = `attr-box ${hasTemp ? 'modified' : ''}`;
    box.title = hasTemp ? `Modificado temporariamente (Base: ${baseVal}). Clique para alterar.` : 'Clique para alterar temporariamente';
    box.innerHTML = `
      <span>${abbr}</span>
      <strong>${displayVal}</strong>
    `;
    box.addEventListener('click', () => openAttrModal(abbr));
    attrContainer.appendChild(box);
  });

  // Integridade Corporal
  const intContainer = document.getElementById('integrity-container');
  intContainer.innerHTML = '';
  BODY_PARTS.forEach(part => {
    const partData = c.integrity[part];
    const isDamaged = partData.status !== 'Ok';

    const details = document.createElement('details');
    details.className = 'integrity-item';

    const optionsHtml = INTEGRITY_OPTIONS.map(opt =>
      `<option value="${opt}" ${partData.status === opt ? 'selected' : ''}>${opt}</option>`
    ).join('');

    details.innerHTML = `
      <summary class="integrity-summary">
        <span>${part}</span>
        <span class="integrity-status-badge ${isDamaged ? 'damaged' : ''}">${partData.status}</span>
      </summary>
      <div class="integrity-body">
        <div>
          <label>Estado da Integridade</label>
          <select class="int-select">${optionsHtml}</select>
        </div>
        <div>
          <label>Descrição e Efeitos</label>
          <textarea class="int-desc expandable-textarea" rows="2" placeholder="Descreva ferimentos, penalidades...">${partData.desc}</textarea>
        </div>
      </div>
    `;

    const selectEl = details.querySelector('.int-select');
    const badgeEl = details.querySelector('.integrity-status-badge');
    const descEl = details.querySelector('.int-desc');

    selectEl.addEventListener('change', (e) => {
      const newStatus = e.target.value;
      c.integrity[part].status = newStatus;
      badgeEl.textContent = newStatus;
      if (newStatus !== 'Ok') {
        badgeEl.classList.add('damaged');
      } else {
        badgeEl.classList.remove('damaged');
      }
      saveToStorage();
    });

    descEl.addEventListener('input', (e) => {
      c.integrity[part].desc = e.target.value;
      saveToStorage();
    });

    intContainer.appendChild(details);
  });

  // Nutrientes
  const nutContainer = document.getElementById('nutrients-container');
  nutContainer.innerHTML = '';
  Object.entries(c.nutrients).forEach(([nutName, data]) => {
    const box = document.createElement('div');
    box.className = 'nutrient-box';
    box.innerHTML = `
      <label>${nutName}</label>
      <span class="nutrient-value">${data.cur} / ${data.max}</span>
      <div class="vital-actions">
        <button type="button" class="btn-damage">Perder</button>
        <button type="button" class="btn-heal">Ganhar</button>
      </div>
    `;
    box.querySelector('.btn-damage').addEventListener('click', () => {
      openAdjustModal('nutrients', nutName, 'sub', nutName);
    });
    box.querySelector('.btn-heal').addEventListener('click', () => {
      openAdjustModal('nutrients', nutName, 'add', nutName);
    });
    nutContainer.appendChild(box);
  });

  renderActions();
  renderSkills();

  // Condições & Notas
  const condEl = document.getElementById('sheet-conditions');
  const notesEl = document.getElementById('sheet-notes');
  condEl.value = c.conditions || '';
  notesEl.value = c.notes || c.actions || '';
  condEl.oninput = () => { c.conditions = condEl.value; saveToStorage(); };
  notesEl.oninput = () => { c.notes = notesEl.value; saveToStorage(); };

  renderEquipment();
  renderInventory();
  initExpandableTextareas();
}

// ================= AÇÕES DO PERSONAGEM =================
const actionForm = document.getElementById('action-form');
const btnCancelActionEdit = document.getElementById('btn-cancel-action-edit');

document.getElementById('btn-toggle-action-form').addEventListener('click', () => {
  resetActionForm();
  actionForm.classList.toggle('hidden');
});

btnCancelActionEdit.addEventListener('click', () => {
  resetActionForm();
  actionForm.classList.add('hidden');
});

function resetActionForm() {
  actionForm.reset();
  document.getElementById('act-edit-id').value = '';
  document.getElementById('btn-submit-action').textContent = 'Salvar Ação';
  btnCancelActionEdit.classList.add('hidden');
}

actionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const c = getActiveChar();
  if (!c) return;

  const editId = document.getElementById('act-edit-id').value;
  const name = document.getElementById('act-name').value.trim();
  const type = document.getElementById('act-type').value;
  const cost = document.getElementById('act-cost').value.trim();
  const dmg = document.getElementById('act-dmg').value.trim();
  const desc = document.getElementById('act-desc').value.trim();

  if (!name) return;

  if (editId) {
    const idx = c.actionsList.findIndex(a => String(a.id) === String(editId));
    if (idx !== -1) {
      c.actionsList[idx] = { ...c.actionsList[idx], name, type, cost, dmg, desc };
    }
  } else {
    c.actionsList.push({
      id: Date.now(),
      name,
      type,
      cost,
      dmg,
      desc
    });
  }

  resetActionForm();
  actionForm.classList.add('hidden');
  saveToStorage();
  renderActions();
});

function renderActions() {
  const c = getActiveChar();
  const listEl = document.getElementById('actions-list');
  listEl.innerHTML = '';

  if (c.actionsList.length === 0) {
    listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Nenhuma ação cadastrada.</p>`;
    return;
  }

  c.actionsList.forEach(act => {
    const card = document.createElement('div');
    card.className = 'action-card';
    card.title = 'Clique para expandir os detalhes desta ação';

    let tagsHtml = `<span class="action-tag">Tipo: ${act.type || 'Ação'}</span>`;
    if (act.cost) tagsHtml += `<span class="action-tag">Custo: ${act.cost}</span>`;
    if (act.dmg) tagsHtml += `<span class="action-tag">Dano: ${act.dmg}</span>`;

    card.innerHTML = `
      <div class="action-card-header">
        <span class="action-card-title">${act.name}</span>
        <div style="display:flex; gap:0.2rem;">
          <button type="button" class="btn-ghost-edit">Editar</button>
          <button type="button" class="btn-danger-ghost">X</button>
        </div>
      </div>
      <div class="action-tags">${tagsHtml}</div>
      ${act.desc ? `<p class="action-desc-preview">${act.desc}</p>` : ''}
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openActionDetailModal(act);
    });

    card.querySelector('.btn-ghost-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('act-edit-id').value = act.id;
      document.getElementById('act-name').value = act.name;
      document.getElementById('act-type').value = act.type || 'Ação';
      document.getElementById('act-cost').value = act.cost || '';
      document.getElementById('act-dmg').value = act.dmg || '';
      document.getElementById('act-desc').value = act.desc || '';
      document.getElementById('btn-submit-action').textContent = 'Atualizar';
      btnCancelActionEdit.classList.remove('hidden');
      actionForm.classList.remove('hidden');
      document.getElementById('act-name').focus();
    });

    card.querySelector('.btn-danger-ghost').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Deseja apagar a ação "${act.name}"?`)) return;
      c.actionsList = c.actionsList.filter(a => a.id !== act.id);
      saveToStorage();
      renderActions();
    });

    listEl.appendChild(card);
  });
}

// ================= PERÍCIAS =================
const skillQuickForm = document.getElementById('skills-quick-add');
const btnCancelSkill = document.getElementById('btn-cancel-skill');

document.getElementById('btn-add-skill-quick').addEventListener('click', () => {
  resetSkillForm();
  skillQuickForm.classList.toggle('hidden');
});

btnCancelSkill.addEventListener('click', () => {
  resetSkillForm();
  skillQuickForm.classList.add('hidden');
});

function resetSkillForm() {
  document.getElementById('skill-edit-id').value = '';
  document.getElementById('new-skill-name').value = '';
  document.getElementById('new-skill-bonus').value = '';
  document.getElementById('new-skill-attr').value = 'FOR';
  document.getElementById('btn-save-skill').textContent = 'Salvar';
  btnCancelSkill.classList.add('hidden');
}

document.getElementById('btn-save-skill').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;

  const editId = document.getElementById('skill-edit-id').value;
  const name = document.getElementById('new-skill-name').value.trim();
  const bonus = Number(document.getElementById('new-skill-bonus').value) || 0;
  const attr = document.getElementById('new-skill-attr').value;
  if (!name) return;

  if (editId) {
    const idx = c.skills.findIndex(s => String(s.id) === String(editId));
    if (idx !== -1) {
      c.skills[idx] = { ...c.skills[idx], name, bonus, attr };
    }
  } else {
    c.skills.push({ id: Date.now(), name, bonus, attr });
  }

  resetSkillForm();
  skillQuickForm.classList.add('hidden');
  saveToStorage();
  renderSkills();
});

function renderSkills() {
  const c = getActiveChar();
  const tbody = document.getElementById('skills-tbody');
  tbody.innerHTML = '';

  if (c.skills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhuma perícia adicionada.</td></tr>`;
    return;
  }

  c.skills.forEach(sk => {
    const tr = document.createElement('tr');
    const sign = sk.bonus >= 0 ? `+${sk.bonus}` : sk.bonus;
    tr.innerHTML = `
      <td><strong>${sk.name}</strong></td>
      <td>${sk.attr}</td>
      <td>${sign}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button type="button" class="btn-ghost-edit">Editar</button>
        <button type="button" class="btn-danger-ghost">X</button>
      </td>
    `;

    tr.querySelector('.btn-ghost-edit').addEventListener('click', () => {
      document.getElementById('skill-edit-id').value = sk.id;
      document.getElementById('new-skill-name').value = sk.name;
      document.getElementById('new-skill-bonus').value = sk.bonus;
      document.getElementById('new-skill-attr').value = sk.attr;
      document.getElementById('btn-save-skill').textContent = 'Atualizar';
      btnCancelSkill.classList.remove('hidden');
      skillQuickForm.classList.remove('hidden');
      document.getElementById('new-skill-name').focus();
    });

    tr.querySelector('.btn-danger-ghost').addEventListener('click', () => {
      if (!confirm(`Deseja apagar a perícia "${sk.name}"?`)) return;
      c.skills = c.skills.filter(s => s.id !== sk.id);
      saveToStorage();
      renderSkills();
    });

    tbody.appendChild(tr);
  });
}

// ================= INVENTÁRIO & CÁLCULO DE PESO =================
function renderEquipment() {
  const c = getActiveChar();
  const eq = c.equipment;

  const bind = (id, obj, prop) => {
    const el = document.getElementById(id);
    el.value = obj[prop] || '';
    el.oninput = () => { obj[prop] = el.value; saveToStorage(); };
  };

  bind('eq-armor-name', eq.armor, 'name');
  bind('eq-armor-prot', eq.armor, 'prot');
  bind('eq-armor-tier', eq.armor, 'tier');

  bind('eq-left-name', eq.left, 'name');
  bind('eq-left-dmg', eq.left, 'dmg');
  bind('eq-left-type', eq.left, 'type');
  bind('eq-left-tier', eq.left, 'tier');

  bind('eq-right-name', eq.right, 'name');
  bind('eq-right-dmg', eq.right, 'dmg');
  bind('eq-right-type', eq.right, 'type');
  bind('eq-right-tier', eq.right, 'tier');
}

const itemForm = document.getElementById('add-item-form');
const btnCancelItem = document.getElementById('btn-cancel-item');

btnCancelItem.addEventListener('click', resetItemForm);

function resetItemForm() {
  itemForm.reset();
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-qty').value = 1;
  document.getElementById('item-form-title').textContent = 'Adicionar Item ao Inventário';
  document.getElementById('btn-submit-item').textContent = '+ Adicionar';
  btnCancelItem.classList.add('hidden');
}

itemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const c = getActiveChar();
  if (!c) return;

  const editId = document.getElementById('item-edit-id').value;
  const qty = Number(document.getElementById('item-qty').value) || 1;
  const name = document.getElementById('item-name').value.trim();
  const weight = Number(document.getElementById('item-weight').value) || 0;
  const extra = document.getElementById('item-extra').value.trim();

  if (editId) {
    const idx = c.inventory.findIndex(i => String(i.id) === String(editId));
    if (idx !== -1) {
      c.inventory[idx] = { ...c.inventory[idx], qty, name, weight, extra };
    }
  } else {
    c.inventory.push({ id: Date.now(), qty, name, weight, extra });
  }

  resetItemForm();
  saveToStorage();
  renderInventory();
});

function renderInventory() {
  const c = getActiveChar();
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = '';

  let totalWeight = 0;

  if (c.inventory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Inventário vazio.</td></tr>`;
  } else {
    c.inventory.forEach(item => {
      const subWeight = item.qty * item.weight;
      totalWeight += subWeight;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.qty}x</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.weight.toFixed(1)} kg</td>
        <td>${subWeight.toFixed(1)} kg</td>
        <td>${item.extra || '-'}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button type="button" class="btn-ghost-edit">Editar</button>
          <button type="button" class="btn-danger-ghost">X</button>
        </td>
      `;

      tr.querySelector('.btn-ghost-edit').addEventListener('click', () => {
        document.getElementById('item-edit-id').value = item.id;
        document.getElementById('item-qty').value = item.qty;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-weight').value = item.weight;
        document.getElementById('item-extra').value = item.extra || '';
        document.getElementById('item-form-title').textContent = `Editando: ${item.name}`;
        document.getElementById('btn-submit-item').textContent = 'Salvar Alterações';
        btnCancelItem.classList.remove('hidden');
        document.getElementById('item-name').focus();
      });

      tr.querySelector('.btn-danger-ghost').addEventListener('click', () => {
        if (!confirm(`Deseja apagar "${item.name}" do inventário?`)) return;
        c.inventory = c.inventory.filter(i => i.id !== item.id);
        saveToStorage();
        renderInventory();
      });

      tbody.appendChild(tr);
    });
  }

  const activeFor = (c.tempAttributes && c.tempAttributes['FOR'] !== undefined) ? c.tempAttributes['FOR'] : c.attributes.FOR;
  const maxWeight = c.bodyWeight * (0.04 + (0.08 * activeFor));
  
  document.getElementById('inv-current-weight').textContent = totalWeight.toFixed(1);
  document.getElementById('inv-max-weight').textContent = maxWeight.toFixed(1);

  const percent = maxWeight > 0 ? Math.min(100, (totalWeight / maxWeight) * 100) : 100;
  const bar = document.getElementById('weight-progress');
  bar.style.width = `${percent}%`;

  const alertBox = document.getElementById('overweight-alert');
  if (totalWeight > maxWeight) {
    bar.classList.add('overweight');
    alertBox.classList.remove('hidden');
    document.getElementById('alert-cur-weight').textContent = `${totalWeight.toFixed(1)} kg`;
    document.getElementById('alert-max-weight').textContent = `${maxWeight.toFixed(1)} kg`;
  } else {
    bar.classList.remove('overweight');
    alertBox.classList.add('hidden');
  }
}

// ================= EXPORTAR E IMPORTAR JSON =================
document.getElementById('btn-export-char').addEventListener('click', () => {
  const c = getActiveChar();
  if (!c) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(c, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const safeName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadAnchor.setAttribute("download", `flesh_and_grit_${safeName}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!imported.name || !imported.attributes) {
        alert('Arquivo JSON inválido para Flesh & Grit.');
        return;
      }
      imported.id = Date.now().toString();
      characters.push(normalizeCharacter(imported));
      saveToStorage();
      renderCharacterList();
      alert(`Sobrevivente "${imported.name}" importado com sucesso.`);
    } catch (err) {
      alert('Erro ao ler o arquivo JSON.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});