const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'recipes.md');
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

function parseRecipes(markdown) {
  const recipes = [];
  const blocks = markdown.replace(/\r/g, '').split(/\n\s*\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    let current = null;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (!current) {
        const parsed = parseTitleAndAuthor(line);
        current = {
          title: parsed.title || line,
          author: parsed.author,
          body: [line]
        };
        continue;
      }

      if (isRecipeTitleLine(line, lines.slice(i + 1))) {
        const body = current.body.join('\n').trim();
        if (!shouldDiscardRecipe(current.title)) {
          const recipe = {
            id: (current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `recipe-${recipes.length + 1}`),
            title: current.title,
            author: current.author,
            category: getCategory(current.title, body),
            tags: getTags(current.title, body),
            submittedBy: current.author,
            excerpt: body.slice(0, 180).replace(/\s+/g, ' '),
            body,
            source: 'recipes.md'
          };

          recipes.push(recipe);
        }

        const nextParsed = parseTitleAndAuthor(line);
        current = {
          title: nextParsed.title || line,
          author: nextParsed.author,
          body: [line]
        };
        continue;
      }

      current.body.push(line);
    }

    if (current && !shouldDiscardRecipe(current.title)) {
      const body = current.body.join('\n').trim();
      const recipe = {
        id: (current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `recipe-${recipes.length + 1}`),
        title: current.title,
        author: current.author,
        category: getCategory(current.title, body),
        tags: getTags(current.title, body),
        submittedBy: current.author,
        excerpt: body.slice(0, 180).replace(/\s+/g, ' '),
        body,
        source: 'recipes.md'
      };

      recipes.push(recipe);
    }
  }

  return recipes.filter((recipe) => recipe.title && recipe.title.length > 1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing source file at ${sourcePath}`);
  process.exit(1);
}

const markdown = fs.readFileSync(sourcePath, 'utf8');
const recipes = parseRecipes(markdown);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));
console.log(`Built ${recipes.length} recipes into ${outputPath}`);
