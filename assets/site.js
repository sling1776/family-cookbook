const CATEGORY_META = {
  'Appetizers & Snacks': 'appetizers',
  'Breakfast': 'breakfast',
  'Soups & Salads': 'soups',
  'Main Dishes': 'mains',
  'Side Dishes': 'sides',
  'Desserts': 'desserts',
  'Drinks': 'drinks',
  'Canning & Preserving': 'preserving',
  'Holiday': 'holiday',
  'Other': 'other'
};

const state = {
  recipes: [],
  search: '',
  category: 'All',
  person: 'All',
  tag: 'All'
};

function getRecipeData() {
  return fetch('data/recipes.json', { cache: 'no-store' })
    .then((response) => response.json())
    .then((recipes) => {
      state.recipes = recipes;
      return recipes;
    })
    .catch((error) => {
      console.error('Unable to load recipes:', error);
      return [];
    });
}

function queryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function groupsForRecipes(recipes) {
  const map = new Map();

  for (const recipe of recipes) {
    const person = recipe.author || 'Unknown';
    map.set(person, (map.get(person) || 0) + 1);
  }

  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function cardMarkup(recipe) {
  const tags = (recipe.tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const category = recipe.category || 'Other';
  const author = recipe.author || 'Family recipe';

  return `
    <article class="recipe-card" data-id="${escapeHtml(recipe.id)}">
      <div class="recipe-card__top">
        <span class="pill">${escapeHtml(category)}</span>
        <span class="tiny-label">From: ${escapeHtml(author)}</span>
      </div>
      <h3>${escapeHtml(recipe.title)}</h3>
      <p>${escapeHtml(recipe.excerpt || 'A family favorite with a rich history and homemade comfort.')}</p>
      <div class="tag-row">${tags}</div>
      <button class="button-secondary" data-action="details" data-id="${escapeHtml(recipe.id)}">View recipe</button>
    </article>
  `;
}

function renderRecipeList(container, recipes) {
  if (!container) {
    return;
  }

  container.innerHTML = recipes.length
    ? recipes.map(cardMarkup).join('')
    : '<div class="empty-state"><h3>No recipes match your filters</h3><p>Try a wider search, a different category, or browse the family pages.</p></div>';

  container.querySelectorAll('[data-action="details"]').forEach((button) => {
    button.addEventListener('click', () => {
      const recipe = recipes.find((item) => item.id === button.dataset.id);
      if (recipe) {
        openRecipeDetail(recipe);
      }
    });
  });
}

function buildFilterOptions() {
  const categories = ['All', ...new Set(state.recipes.map((recipe) => recipe.category || 'Other'))];
  const authors = ['All', ...new Set(state.recipes.map((recipe) => recipe.author || 'Unknown'))];
  const tags = ['All', ...new Set(state.recipes.flatMap((recipe) => recipe.tags || []))];

  const categorySelect = document.querySelector('#category-filter');
  const personSelect = document.querySelector('#person-filter');
  const tagSelect = document.querySelector('#tag-filter');

  if (categorySelect) {
    categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    categorySelect.value = state.category || 'All';
  }

  if (personSelect) {
    personSelect.innerHTML = authors.map((person) => `<option value="${escapeHtml(person)}">${escapeHtml(person)}</option>`).join('');
    personSelect.value = state.person || 'All';
  }

  if (tagSelect) {
    tagSelect.innerHTML = tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    tagSelect.value = state.tag || 'All';
  }
}

function applyRecipeFilters() {
  const searchText = normalizeText(state.search);

  const filtered = state.recipes.filter((recipe) => {
    const haystack = normalizeText(`${recipe.title} ${recipe.author} ${recipe.category} ${(recipe.tags || []).join(' ')} ${recipe.body}`);
    const matchesText = !searchText || haystack.includes(searchText);
    const matchesCategory = state.category === 'All' || recipe.category === state.category;
    const matchesPerson = state.person === 'All' || (recipe.author || 'Unknown') === state.person;
    const matchesTag = state.tag === 'All' || (recipe.tags || []).includes(state.tag);
    return matchesText && matchesCategory && matchesPerson && matchesTag;
  });

  const recipeList = document.querySelector('#recipe-list');
  const count = document.querySelector('#recipe-count');

  renderRecipeList(recipeList, filtered);

  if (count) {
    count.textContent = `${filtered.length} recipes found`;
  }
}

function setupFilters() {
  const searchInput = document.querySelector('#search-input');
  const categorySelect = document.querySelector('#category-filter');
  const personSelect = document.querySelector('#person-filter');
  const tagSelect = document.querySelector('#tag-filter');

  if (searchInput) {
    searchInput.value = state.search;
    searchInput.addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      applyRecipeFilters();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', (event) => {
      state.category = event.target.value;
      applyRecipeFilters();
    });
  }

  if (personSelect) {
    personSelect.addEventListener('change', (event) => {
      state.person = event.target.value;
      applyRecipeFilters();
    });
  }

  if (tagSelect) {
    tagSelect.addEventListener('change', (event) => {
      state.tag = event.target.value;
      applyRecipeFilters();
    });
  }
}

function renderHomeHighlights() {
  const featured = document.querySelector('#featured-recipes');
  if (!featured) {
    return;
  }

  const picks = state.recipes.slice(0, 6);
  featured.innerHTML = picks.map(cardMarkup).join('');
  featured.querySelectorAll('[data-action="details"]').forEach((button) => {
    button.addEventListener('click', () => {
      const recipe = state.recipes.find((item) => item.id === button.dataset.id);
      if (recipe) {
        openRecipeDetail(recipe);
      }
    });
  });
}

function renderFamilyPage() {
  const familyList = document.querySelector('#family-list');
  if (!familyList) {
    return;
  }

  const family = groupsForRecipes(state.recipes);
  familyList.innerHTML = family.map(([person, count]) => `
    <li>
      <div>
        <h3>${escapeHtml(person)}</h3>
        <p>${count} recipe${count === 1 ? '' : 's'}</p>
      </div>
      <a href="recipes.html?person=${encodeURIComponent(person)}" class="button-link">Browse</a>
    </li>
  `).join('');
}

function renderCategories() {
  const list = document.querySelector('#category-links');
  if (!list) {
    return;
  }

  const counts = new Map();
  for (const recipe of state.recipes) {
    const category = recipe.category || 'Other';
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  list.innerHTML = categories.map(([name, count]) => `
    <a href="recipes.html?category=${encodeURIComponent(name)}" class="category-tile">
      <span>${escapeHtml(name)}</span>
      <small>${count} recipes</small>
    </a>
  `).join('');
}

function openRecipeDetail(recipe) {
  const dialog = document.querySelector('#recipe-detail-dialog');
  const body = document.querySelector('#detail-body');
  if (!dialog || !body) {
    return;
  }

  const lines = (recipe.body || '').split('\n').filter((line) => line.trim());
  body.innerHTML = `
    <div class="detail-header">
      <div>
        <span class="pill">${escapeHtml(recipe.category || 'Other')}</span>
        <h2>${escapeHtml(recipe.title)}</h2>
      </div>
      <button class="close-button" data-close="detail">Close</button>
    </div>
    <div class="detail-meta">
      <span>Submitted by: ${escapeHtml(recipe.author || 'Family recipe')}</span>
      <span>Tags: ${escapeHtml((recipe.tags || []).join(', ') || 'None listed')}</span>
    </div>
    <div class="detail-copy">
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
    </div>
  `;

  dialog.classList.add('is-open');
  document.querySelector('[data-close="detail"]').addEventListener('click', () => {
    dialog.classList.remove('is-open');
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initializeRecipePage() {
  const searchInput = document.querySelector('#search-input');
  const categorySelect = document.querySelector('#category-filter');
  const personSelect = document.querySelector('#person-filter');
  const tagSelect = document.querySelector('#tag-filter');

  if (searchInput) {
    const initialQuery = queryParam('search') || queryParam('query') || '';
    state.search = initialQuery;
    searchInput.value = initialQuery;
  }

  if (categorySelect) {
    const initialCategory = queryParam('category') || 'All';
    state.category = initialCategory;
    categorySelect.value = initialCategory;
  }

  if (personSelect) {
    const initialPerson = queryParam('person') || 'All';
    state.person = initialPerson;
    personSelect.value = initialPerson;
  }

  if (tagSelect) {
    state.tag = 'All';
    tagSelect.value = 'All';
  }
}

async function initApp() {
  const recipes = await getRecipeData();
  if (!recipes.length) {
    return;
  }

  initializeRecipePage();
  buildFilterOptions();
  setupFilters();
  applyRecipeFilters();
  renderHomeHighlights();
  renderFamilyPage();
  renderCategories();
}

document.addEventListener('DOMContentLoaded', initApp);
