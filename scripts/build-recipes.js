const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'recipes');
const outputPath = path.join(rootDir, 'data', 'recipes.json');

function trimAndNormalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseTitleAndAuthor(rawLine) {
  const line = trimAndNormalize(rawLine);
  if (!line || line.startsWith('#')) {
    return { title: '', author: '' };
  }

  const match = line.match(/^(.*?)(?:\s*[–—-]\s*)(.+)$/);
  if (!match) {
    return { title: line, author: '' };
  }

  let title = trimAndNormalize(match[1]);
  let author = trimAndNormalize(match[2].replace(/\s*[–—-]\s*.*$/, ''));

  if (!author || author.length < 2) {
    return { title: line, author: '' };
  }

  return { title, author };
}

function getCategory(title, body) {
  const haystack = `${title} ${body}`.toLowerCase();

  if (/(dip|ball|nacho|salsa|guacamole|appetizer|pizza|tostaditas|wrap|snack)/.test(haystack)) {
    return 'Appetizers & Snacks';
  }
  if (/(breakfast|pancake|waffle|muffin|biscuit|eggs|roll|bread|casserole)/.test(haystack)) {
    return 'Breakfast';
  }
  if (/(soup|salad|chili|stew|bean|taco|queso)/.test(haystack)) {
    return 'Soups & Salads';
  }
  if (/(chicken|beef|pork|lasagna|pasta|meat|roast|casserole|enchilada|burger|turkey)/.test(haystack)) {
    return 'Main Dishes';
  }
  if (/(side|vegetable|potato|rice|green|corn|beans|fruit)/.test(haystack)) {
    return 'Side Dishes';
  }
  if (/(cake|cookie|pie|bar|cobbler|brownie|dessert|sweet|crisp|pudding)/.test(haystack)) {
    return 'Desserts';
  }
  if (/(drink|tea|lemonade|smoothie|punch|coffee)/.test(haystack)) {
    return 'Drinks';
  }
  if (/(jam|jelly|pickle|preserve|canning|syrup|butter|relish)/.test(haystack)) {
    return 'Canning & Preserving';
  }
  if (/(holiday|christmas|easter|thanksgiving|seasonal)/.test(haystack)) {
    return 'Holiday';
  }

  return 'Other';
}

function getTags(title, body) {
  const stopWords = new Set([
    'about', 'after', 'again', 'all', 'also', 'and', 'any', 'are', 'around', 'as', 'at', 'be',
    'because', 'been', 'before', 'being', 'between', 'both', 'but', 'by', 'came', 'can', 'could',
    'did', 'do', 'does', 'for', 'from', 'get', 'gets', 'got', 'had', 'has', 'have', 'here', 'how',
    'if', 'into', 'is', 'it', 'its', 'just', 'like', 'made', 'many', 'me', 'mix', 'more', 'most',
    'much', 'new', 'not', 'now', 'of', 'off', 'on', 'one', 'or', 'our', 'out', 'over', 'same', 'see',
    'should', 'so', 'some', 'still', 'such', 'take', 'than', 'that', 'the', 'their', 'them', 'then',
    'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'up', 'very', 'want',
    'was', 'way', 'we', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why',
    'will', 'with', 'without', 'would', 'you', 'your', 'recipe', 'favorite', 'aka', 'family', 'good', 'great',
    'tasty', 'best', 'about', 'into'
  ]);

  const text = `${title} ${body}`;
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .filter((token) => !/^(cup|cups|tbsp|tsp|oz|lb|min|minute|minutes|seconds|mix|stir|bake|heat|add|serve|yield|salt|pepper)$/i.test(token))
    .filter((token, index, arr) => arr.indexOf(token) === index);

  return tokens.slice(0, 8);
}

function isIngredientLike(line) {
  if (!line) {
    return false;
  }

  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) {
    return false;
  }

  if (/^[0-9¼½¾⅓⅔⅛]/.test(trimmed)) {
    return true;
  }

  if (/^(?:\d+\s*[-/\s]*)?\d*\s*(?:cups?|tbsp|tsp|oz|pkg|package|jar|can|bunch|stalk|slice|clove|lb|g|gr|grams|ml|qt|pt|dash|pinch|drops|loaf|strips?|eggs?|pieces?|pounds?)\b/i.test(trimmed)) {
    return true;
  }

  if (/^(?:coarsely|finely|minced|cracked|grated|crumbled|sliced|diced|shredded|thinly|fresh|peeled|chopped|cut|juice|salt|pepper|onion salt|garlic salt|seasoning salt|accent|water|milk|flour|sugar|butter|eggs?|onion|celery|carrots?|parsley|worcestershire sauce|mayo|mayonnaise|sour cream|cream cheese|cheddar cheese|green onions|chili|lemon juice|mushrooms|shrimp|nuts?|parsley flakes|almonds?|pecans?|dates?|bacon|breadcrumbs?|spinach|garlic|cinnamon|vanilla|oil|vinegar|crackers)/i.test(trimmed)) {
    return true;
  }

  if (/\bfrom\b/i.test(trimmed) && /\b(?:chicken|lemon|milk|cream|cheese|water|sour|cream|shrimp|crab|tuna|butter|sugar)\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

function isRecipeTitleLine(line, followingLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120 || /^(?:mix|stir|combine|add|bake|preheat|serve|shape|cut|roll|cook|bring|pour|drain|fold|whisk|sprinkle|refrigerate|freeze|chill|form|yield)/i.test(trimmed)) {
    return false;
  }

  if (/^(?:\d|[¼½¾⅓⅔⅛])/.test(trimmed) || isIngredientLike(trimmed)) {
    return false;
  }

  if (trimmed.includes('–') || trimmed.includes('—') || trimmed.includes('-')) {
    const afterDash = trimmed.split(/[–—-]/).slice(1).join(' ').trim();
    if (!afterDash) {
      return false;
    }
    if (/^[a-z]/.test(afterDash)) {
      return false;
    }
    return true;
  }

  const nextIngredientCount = (followingLines || []).slice(0, 4).filter(isIngredientLike).length;
  return nextIngredientCount >= 2;
}

function shouldDiscardRecipe(title) {
  const value = title.trim();
  if (!value || value.length < 3) {
    return true;
  }

  if (/^[\s"“]/.test(value) || /[-–—]\s*$/.test(value)) {
    return true;
  }

  if (/^(?:this|that|these|those|with|from|my|our|aka|yield|note|about|recipe|ready|favorite|a favorite|or|ripening|small|non|i got|this recipe)/i.test(value)) {
    return true;
  }

  if (/\b(?:brings|memories|favorite|notes?)\b/i.test(value) || ( /\bwith\b/i.test(value) && /\b(?:homemade|flour|tortillas)/i.test(value) )) {
    return true;
  }

  return false;
}

function parseSectionMap(lines) {
  const groups = { none: [] };
  let currentKey = 'none';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const subheaderMatch = trimmed.match(/^###\s+(.+)$/);
    if (subheaderMatch) {
      const key = subheaderMatch[1].trim();
      if (!groups[key]) {
        groups[key] = [];
      }
      currentKey = key;
      continue;
    }

    if (!groups[currentKey]) {
      groups[currentKey] = [];
    }
    groups[currentKey].push(trimmed);
  }

  return groups;
}

function parseRecipeFile(filePath) {
  const markdown = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = markdown.split('\n');

  let title = '';
  let author = '';
  let currentSection = null;
  const sections = {
    author: [],
    ingredients: [],
    procedure: [],
    notes: []
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const titleMatch = trimmed.match(/^#\s+(.+)$/);
    if (titleMatch && !trimmed.startsWith('##')) {
      title = titleMatch[1].trim();
      currentSection = null;
      continue;
    }

    const sectionMatch = trimmed.match(/^##\s+(Author|Ingredients|Procedure|Notes)\s*:?(.*)$/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      const inlineValue = sectionMatch[2].trim();
      if (inlineValue) {
        if (currentSection === 'author') {
          author = inlineValue;
        } else {
          sections[currentSection].push(inlineValue);
        }
      }
      continue;
    }

    if (currentSection === 'author') {
      if (!author) {
        author = trimmed;
      }
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(trimmed);
    }
  }

  const ingredients = parseSectionMap(sections.ingredients);
  const procedure = parseSectionMap(sections.procedure);
  const notes = sections.notes.filter(Boolean);
  const searchableText = [title, author, ...Object.values(ingredients).flat(), ...Object.values(procedure).flat(), ...notes].join('\n');
  const hasMeaningfulContent = !![author, ...Object.values(ingredients).flat(), ...Object.values(procedure).flat(), ...notes].filter(Boolean).length;

  if (!title || !hasMeaningfulContent) {
    return null;
  }

  return {
    id: toSlug(title),
    title,
    author: author || 'Unknown Author',
    category: getCategory(title, searchableText),
    tags: getTags(title, searchableText),
    ingredients,
    procedure,
    notes,
    source: `recipes/${path.basename(filePath)}`
  };
}

function parseRecipesFromDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath)
    .filter((fileName) => fileName.toLowerCase().endsWith('.md'))
    .sort();

  const recipes = [];

  for (const fileName of files) {
    const filePath = path.join(dirPath, fileName);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      continue;
    }

    const recipe = parseRecipeFile(filePath);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  return recipes.filter((recipe) => recipe.title && recipe.title.length > 1);
}

function toSlug(value, maxLength = 60) {
  const slug = (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'recipe';

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

function extractRecipeParts(recipe) {
  const lines = (recipe.body || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const ingredientLines = [];
  const procedureLines = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].replace(/^[-*]\s*/, '').trim();
    if (!line) {
      continue;
    }

    if (isIngredientLike(line)) {
      ingredientLines.push(line);
      continue;
    }

    if (/^(yield|makes|serves|servings?):/i.test(line)) {
      procedureLines.push(line);
      continue;
    }

    procedureLines.push(line);
  }

  return {
    title: recipe.title || 'Untitled Recipe',
    author: recipe.author || 'Unknown Author',
    ingredients: ingredientLines.length ? ingredientLines : ['No ingredients listed.'],
    procedure: procedureLines.length ? procedureLines : ['No procedure provided.']
  };
}

function recipeToMarkdown(recipe) {
  const { title, author, ingredients, procedure } = extractRecipeParts(recipe);
  const ingredientList = ingredients.map((item) => `- ${item}`).join('\n');
  const procedureList = procedure
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');

  return `# ${title}\n\nAuthor: ${author}\n\n## Ingredients\n${ingredientList}\n\n## Procedure\n${procedureList}\n`;
}

function writeRecipeFiles(recipes) {
  fs.mkdirSync(recipesDir, { recursive: true });

  const usedNames = new Set();

  for (let index = 0; index < recipes.length; index += 1) {
    const recipe = recipes[index];
    let fileName = `${toSlug(recipe.title)}.md`;
    if (usedNames.has(fileName)) {
      let suffix = 2;
      let candidate = `${toSlug(recipe.title, 45)}-${suffix}.md`;
      while (usedNames.has(candidate)) {
        suffix += 1;
        candidate = `${toSlug(recipe.title, 45)}-${suffix}.md`;
      }
      fileName = candidate;
    }

    usedNames.add(fileName);
    fs.writeFileSync(path.join(recipesDir, fileName), recipeToMarkdown(recipe), 'utf8');
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing source directory at ${sourceDir}`);
  process.exit(1);
}

const recipes = parseRecipesFromDirectory(sourceDir);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));
console.log(`Built ${recipes.length} recipes into ${outputPath} from ${sourceDir}`);
