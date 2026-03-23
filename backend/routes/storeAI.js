const express = require('express');
const fs = require('fs');
const path = require('path');
const Store = require('../models/Store');
const authMiddleware = require('../middleware/authMiddleware');
const ownerCheckMiddleware = require('../middleware/ownerCheckMiddleware');

const router = express.Router();

const serializeForScriptTag = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

router.get('/test-ai', (req, res) => {
  console.log('🧪 Test AI route hit');
  res.json({
    success: true,
    message: 'StoreAI routes are working',
    timestamp: new Date().toISOString(),
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
  });
});

// Industry-specific design templates with different structures
const DESIGN_ARCHETYPES = {
  ecommerce: {
    structure: ['hero-product', 'featured-products', 'categories', 'testimonials', 'instagram-feed', 'newsletter'],
    pages: ['Home', 'Shop', 'Product', 'Cart', 'About'],
    stylePresets: ['modern', 'minimal', 'bold'],
    layouts: ['grid-heavy', 'image-focused', 'card-based']
  },
  saas: {
    structure: ['hero-headline', 'features-grid', 'how-it-works', 'pricing-tiers', 'testimonials', 'cta-banner'],
    pages: ['Home', 'Features', 'Pricing', 'About', 'Contact'],
    stylePresets: ['professional', 'modern', 'tech'],
    layouts: ['centered-content', 'split-screen', 'floating-cards']
  },
  portfolio: {
    structure: ['hero-minimal', 'portfolio-masonry', 'about-visual', 'services', 'contact-form'],
    pages: ['Home', 'Work', 'About', 'Services', 'Contact'],
    stylePresets: ['minimal', 'bold', 'creative'],
    layouts: ['masonry', 'full-bleed', 'asymmetric']
  },
  restaurant: {
    structure: ['hero-image', 'menu-showcase', 'chef-story', 'gallery-food', 'reservations', 'location-map'],
    pages: ['Home', 'Menu', 'About', 'Reservations', 'Contact'],
    stylePresets: ['elegant', 'warm', 'luxury'],
    layouts: ['image-driven', 'menu-focused', 'story-telling']
  },
  agency: {
    structure: ['hero-bold', 'services-cards', 'case-studies', 'team', 'process-timeline', 'contact'],
    pages: ['Home', 'Services', 'Work', 'Team', 'Contact'],
    stylePresets: ['bold', 'creative', 'professional'],
    layouts: ['dynamic', 'section-breaks', 'diagonal-cuts']
  },
  blog: {
    structure: ['hero-banner', 'featured-posts', 'post-grid', 'categories', 'author-bio', 'newsletter'],
    pages: ['Home', 'Blog', 'About', 'Categories', 'Contact'],
    stylePresets: ['minimal', 'editorial', 'magazine'],
    layouts: ['magazine', 'sidebar', 'featured-first']
  },
  landing: {
    structure: ['hero-conversion', 'benefits', 'social-proof', 'faq', 'final-cta'],
    pages: ['Home'],
    stylePresets: ['high-contrast', 'conversion-focused', 'bold'],
    layouts: ['single-page', 'long-scroll', 'section-anchored']
  }
};

// Comprehensive section type library - STANDARDIZED NAMES
const SECTION_CATALOG = `
SECTION TYPES BY CATEGORY (use these exact type names):

HERO VARIATIONS:
- hero: Default hero with overlay (specify variant: "overlay", "minimal", "split", "gradient")
- Type: "hero", variant: "minimal" - Clean, centered text
- Type: "hero", variant: "split" - Split screen layout
- Type: "hero", variant: "overlay" - Full-width with overlay text

CONTENT SECTIONS:
- features: Feature grid (specify variant: "cards", "icons-row", "alternating")
- stats: Statistics showcase with numbers
- process: Step-by-step process or timeline
- about: About section with text and optional image
- textblock: Rich text content section

VISUAL SECTIONS:
- gallery: Image gallery (specify variant: "grid", "masonry", "carousel")
- video: Video embed section
- categories: Category tiles with images

SOCIAL PROOF:
- testimonials: Customer testimonials (specify variant: "cards", "slider")
- partners: Partner/client logos

COMMERCE:
- products: Product grid for e-commerce
- pricing: Pricing tiers with features
- services: Service offerings

CONVERSION:
- cta: Call-to-action section
- newsletter: Email signup form
- contact: Contact form with fields
- location: Location/map with contact info

TEAM & INFO:
- team: Team member cards
- faq: FAQ accordion

NAVIGATION:
- navbar: Navigation bar (usually auto-added)
- footer: Footer section (usually auto-added)

IMPORTANT: Use simple type names (e.g., "hero", "features", "testimonials") and use the "variant" property for variations.
Example: { "type": "hero", "variant": "split", ... }
NOT: { "type": "hero-split", ... }
`;

// Visual style variations
const STYLE_SYSTEM = `
STYLE PRESETS:
- minimal: Clean, lots of whitespace, subtle colors, simple typography
- modern: Geometric shapes, gradients, rounded corners, contemporary
- bold: High contrast, large typography, vibrant colors, dramatic
- elegant: Refined typography, muted colors, sophisticated spacing
- playful: Rounded everything, bright colors, friendly tone
- professional: Structured, corporate colors, serif fonts, formal
- luxury: Premium feel, gold accents, premium imagery
- tech: Futuristic, blue/purple tones, sharp edges, innovative
- creative: Asymmetric layouts, artistic elements, unique patterns
- editorial: Magazine-style, strong typography, image-text balance
- brutalist: Raw, stark, unconventional, experimental
- glass: Glassmorphism effects, transparency, blur, depth
- neumorphic: Soft shadows, subtle elevation, tactile feel
- gradient: Colorful gradients, vibrant, energetic
`;

const LAYOUT_PATTERNS = `
LAYOUT ARCHITECTURES:
- grid-heavy: Everything in grids, structured, organized
- image-focused: Large images dominate, minimal text
- card-based: Content in cards, clear boundaries
- centered-content: All content centered, symmetrical
- split-screen: Divided layouts, contrasting sections
- floating-cards: Cards with shadows, layered
- masonry: Pinterest-style, varying heights
- full-bleed: Edge-to-edge imagery, immersive
- asymmetric: Off-center, dynamic, interesting
- magazine: Editorial layouts, columns, typography
- single-page: All content on one page, smooth scroll
- long-scroll: Extended single page, story-driven
- sidebar: Content + sidebar navigation
- section-breaks: Clear section dividers, distinct areas
- diagonal-cuts: Angled section breaks, dynamic
- section-anchored: Jump-to sections, navigation links
`;

function buildEnhancedPrompt(userPrompt, storeContext = {}, previousAttempts = 0) {
  // Analyze prompt to detect industry/type
  const promptLower = userPrompt.toLowerCase();
  let detectedType = 'landing';
  let keywords = [];
  
  if (promptLower.includes('shop') || promptLower.includes('store') || promptLower.includes('ecommerce') || promptLower.includes('coffee') || promptLower.includes('product')) {
    detectedType = 'ecommerce';
    keywords = ['coffee', 'shop', 'product', 'menu', 'buy'];
  } else if (promptLower.includes('saas') || promptLower.includes('software') || promptLower.includes('app') || promptLower.includes('platform')) {
    detectedType = 'saas';
    keywords = ['features', 'workflow', 'automation', 'solution', 'productivity'];
  } else if (promptLower.includes('portfolio') || promptLower.includes('designer') || promptLower.includes('photographer')) {
    detectedType = 'portfolio';
    keywords = ['work', 'projects', 'creative', 'showcase'];
  } else if (promptLower.includes('restaurant') || promptLower.includes('cafe') || promptLower.includes('food') || promptLower.includes('menu')) {
    detectedType = 'restaurant';
    keywords = ['menu', 'chef', 'dining', 'cuisine'];
  } else if (promptLower.includes('agency') || promptLower.includes('marketing') || promptLower.includes('consulting')) {
    detectedType = 'agency';
    keywords = ['services', 'team', 'solutions', 'clients'];
  } else if (promptLower.includes('blog') || promptLower.includes('magazine') || promptLower.includes('news')) {
    detectedType = 'blog';
    keywords = ['articles', 'posts', 'stories', 'content'];
  }

  const archetype = DESIGN_ARCHETYPES[detectedType] || DESIGN_ARCHETYPES.landing;
  
  // Randomize style choices for variety
  const randomStyle = archetype.stylePresets[Math.floor(Math.random() * archetype.stylePresets.length)];
  const randomLayout = archetype.layouts[Math.floor(Math.random() * archetype.layouts.length)];
  
  // Add variation based on attempt number to avoid repeats
  const variationSeed = previousAttempts > 0 ? `\nVARIATION ${previousAttempts + 1}: Use a completely different visual approach than before.` : '';
  
  const randomSeed = Math.random().toString(36).substring(7);
  const timestamp = Date.now();

  return `You are an expert web designer AI creating UNIQUE, DIVERSE website designs.

${SECTION_CATALOG}

${STYLE_SYSTEM}

${LAYOUT_PATTERNS}

DETECTED WEBSITE TYPE: ${detectedType.toUpperCase()}
SUGGESTED STRUCTURE: ${archetype.structure.join(' → ')}
RECOMMENDED PAGES: ${archetype.pages.join(', ')}
STYLE DIRECTION: ${randomStyle}
LAYOUT PATTERN: ${randomLayout}
KEYWORDS TO EMPHASIZE: ${keywords.join(', ')}${variationSeed}

CRITICAL REQUIREMENTS:
1. The visual structure MUST match the website type (${detectedType})
2. DO NOT use generic hero → features → testimonials for everything
3. Each industry needs DIFFERENT section types and order
4. For ${detectedType} specifically:
   ${detectedType === 'ecommerce' ? '- Use product grids, category showcases, shopping features\n   - Include "Shop" page with product listings\n   - Use warm, inviting colors' : ''}
   ${detectedType === 'saas' ? '- Use features-grid, how-it-works, pricing tiers\n   - Include "Features" and "Pricing" pages\n   - Use modern, tech-forward colors (blues, purples)' : ''}
   ${detectedType === 'portfolio' ? '- Use masonry galleries, project showcases\n   - Include "Work" page with portfolio items\n   - Use minimal, creative styling' : ''}
   ${detectedType === 'restaurant' ? '- Use menu showcases, food galleries, reservation forms\n   - Include "Menu" page with food items\n   - Use warm, appetizing colors' : ''}
   ${detectedType === 'agency' ? '- Use service cards, case studies, team profiles\n   - Include "Services" and "Work" pages\n   - Use bold, professional styling' : ''}

USER PROMPT: "${userPrompt}"
RANDOMNESS: ${randomSeed}-${timestamp}

OUTPUT SCHEMA (JSON only, no markdown):
{
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "backgroundColor": "#hex",
    "textColor": "#hex",
    "bannerUrl": "",
    "logoUrl": "",
    "fonts": "Font1, Font2, fallback",
    "stylePreset": "${randomStyle}",
    "borderRadius": "sm|md|lg|xl|2xl|pill",
    "shadow": "none|soft|medium|elevated|dramatic",
    "layoutPattern": "${randomLayout}"
  },
  "layout": {
    "pages": [
      {
        "name": "Page Name",
        "path": "/path",
        "description": "Purpose of this page",
        "sections": [
          {
            "type": "hero|features|products|testimonials|pricing|gallery|stats|process|about|team|faq|cta|newsletter|contact|location|categories|partners",
            "variant": "optional-variant-name",
            "id": "unique-id",
            "title": "Section Title",
            "subtitle": "Optional subtitle",
            ...type-specific-properties
          }
        ]
      }
    ]
  },
  "metadata": {
    "siteName": "Name",
    "description": "SEO description",
    "industry": "${detectedType}"
  }
}

CRITICAL SECTION RULES:
- Use SIMPLE type names: "hero", "features", "products", "testimonials", etc.
- Use "variant" property for variations: { "type": "hero", "variant": "split" }
- DO NOT use compound type names like "hero-split" or "features-grid"
- Valid types: hero, features, products, services, testimonials, pricing, gallery, stats, process, about, team, faq, cta, newsletter, contact, location, categories, partners, textblock
- Valid variants depend on type:
  * hero: "overlay", "split", "minimal", "gradient"
  * features: "cards", "icons-row", "alternating"
  * gallery: "grid", "masonry", "carousel"
  * testimonials: "cards", "slider"

PAGE RULES (MANDATORY):
- Include at least these pages: "Home", "About", "Contact", and "Products" (or "Collection").
- Use paths: "/" for Home, "/about" for About, "/contact" for Contact, and "/products" (or "/collection").
- Each page must contain meaningful sections (Home 5–7 sections; others 3–5). Do not leave any page empty.

SECTION VARIETY RULES:
- Home page: Use 5-7 different section types
- Other pages: Use 3-5 different section types
- NEVER repeat the same section type on one page unless it's intentional (like multiple CTAs)
- Mix visual and content sections
- Vary the order dramatically based on website type

COLOR PALETTE RULES:
- ${detectedType === 'ecommerce' ? 'Warm, inviting (browns, oranges, warm neutrals)' : ''}
- ${detectedType === 'saas' ? 'Modern tech (blues, purples, teals, with bright accents)' : ''}
- ${detectedType === 'portfolio' ? 'Minimal (black, white, one accent color)' : ''}
- ${detectedType === 'restaurant' ? 'Appetizing (reds, oranges, golds, earthy tones)' : ''}
- ${detectedType === 'agency' ? 'Bold professional (deep blues, blacks, vibrant accents)' : ''}
- All colors must be in hex format

CONTENT RULES:
- Use realistic content related to "${userPrompt}"
- Image URLs: https://picsum.photos/seed/{unique-keyword}-${randomSeed}/WIDTHxHEIGHT
- Make each section's content unique and contextual
- Include specific details about the business/product/service

EXAMPLE SECTION STRUCTURES:

Hero Example:
{
  "type": "hero",
  "variant": "split",
  "id": "hero-1",
  "title": "Your Main Headline",
  "subtitle": "Supporting description",
  "image": "https://picsum.photos/seed/keyword-123/1200/800",
  "cta": {
    "text": "Get Started",
    "link": "/contact"
  }
}

Products Example:
{
  "type": "products",
  "variant": "cards",
  "id": "products-1",
  "title": "Our Products",
  "products": [
    {
      "name": "Product Name",
      "description": "Product description",
      "price": "$19.99",
      "image": "https://picsum.photos/seed/product-1/400/400"
    }
  ]
}

Features Example:
{
  "type": "features",
  "variant": "cards",
  "id": "features-1",
  "title": "Key Features",
  "features": [
    {
      "icon": "⚡",
      "title": "Feature Name",
      "description": "Feature description"
    }
  ]
}

Testimonials Example:
{
  "type": "testimonials",
  "variant": "cards",
  "id": "testimonials-1",
  "title": "What Our Customers Say",
  "testimonials": [
    {
      "text": "This is amazing!",
      "name": "John Doe",
      "rating": 5,
      "avatar": "https://i.pravatar.cc/150?img=1"
    }
  ]
}

Categories Example (for e-commerce):
{
  "type": "categories",
  "id": "categories-1",
  "title": "Shop By Category",
  "categories": [
    {
      "name": "Category Name",
      "image": "https://picsum.photos/seed/category-1/400/400",
      "link": "/shop/category"
    }
  ]
}

Generate a ${detectedType} website with a completely unique structure and design now.`;
}

// Enhanced JSON extraction
function extractJsonString(s) {
  if (!s) return '';
  let t = String(s).trim();

  const fenceMatch = t.match(/```(?:json|jsonc)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    t = fenceMatch[1].trim();
  }

  const firstBrace = t.indexOf('{');
  const lastBrace = t.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }

  return t.trim();
}

// Robust JSON parser
function tryParseJsonWithRepairs(src) {
  try {
    return JSON.parse(src);
  } catch {}

  let fixed = src.replace(/,\s*(?=[}\]])/g, '');
  try {
    return JSON.parse(fixed);
  } catch {}

  const chars = fixed.split('');
  let inStr = false;
  let escaped = false;
  const stack = [];
  
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      if (stack.length && ((c === '}' && stack[stack.length - 1] === '{') || 
          (c === ']' && stack[stack.length - 1] === '['))) {
        stack.pop();
      }
    }
  }

  let repaired = fixed;
  if (inStr) repaired += '"';
  
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === '{' ? '}' : ']';
  }

  try {
    return JSON.parse(repaired);
  } catch (e) {
    console.error('All JSON repair strategies failed:', e);
    throw new Error('Invalid JSON structure');
  }
}

function normalizeLayout(layout) {
  if (!layout) {
    return { pages: [] };
  }
  
  if (Array.isArray(layout.pages)) {
    return {
      pages: layout.pages.map(page => ({
        name: page.name || 'Untitled Page',
        path: page.path || '/',
        description: page.description || '',
        sections: (page.sections || []).map(section => normalizeSection(section))
      }))
    };
  }
  
  if (Array.isArray(layout.sections)) {
    return {
      pages: [{
        name: 'Home',
        path: '/',
        sections: layout.sections.map(section => normalizeSection(section))
      }]
    };
  }
  
  return { pages: [] };
}

// Ensure the core pages exist: Home, About, Contact, Products
function ensureCorePages(layout, store) {
  const pages = Array.isArray(layout?.pages) ? layout.pages.slice() : [];
  const getName = (s) => (s || '').toString().trim();
  const existsByName = (name) => pages.some(p => getName(p.name).toLowerCase() === name.toLowerCase());
  const storeName = getName(store?.storeName || store?.name || store?.metadata?.siteName || 'Store');

  const ensurePage = (name, path, sectionsBuilder) => {
    if (!existsByName(name)) {
      pages.push({
        name,
        path,
        description: `${name} page`,
        sections: sectionsBuilder().map(s => normalizeSection(s))
      });
    }
  };

  ensurePage('Home', '/', () => ([
    { type: 'hero', title: `Welcome to ${storeName}`, subtitle: 'Discover our latest products', image: `https://picsum.photos/seed/${Date.now()}-home/1200/600` }
  ]));

  ensurePage('About', '/about', () => ([
    { type: 'about', title: 'About Us', content: `${storeName} — our story and mission.`, image: `https://picsum.photos/seed/${Date.now()}-about/1000/600` }
  ]));

  ensurePage('Contact', '/contact', () => ([
    { type: 'contact', title: 'Contact Us', subtitle: 'We usually reply within 24 hours.' },
    { type: 'location', address: '123 Main St', phone: '+1 (000) 000-0000', email: 'hello@example.com' }
  ]));

  // Prefer Products; if a page named Collection exists, keep both
  if (!existsByName('Products') && !existsByName('Collection')) {
    pages.push({
      name: 'Products',
      path: '/products',
      description: 'Browse our catalog',
      sections: [
        normalizeSection({ type: 'products', title: 'Browse Our Products', items: [
          { name: 'Sample Product', price: '$19.99', image: `https://picsum.photos/seed/${Date.now()}-prod/400/300`, description: 'Great quality' }
        ] })
      ]
    });
  }

  return { pages };
}

// Ensure every page includes a navbar at the top and a footer at the bottom
function ensureNavAndFooter(layout, store) {
  const safeLayout = layout && Array.isArray(layout.pages) ? layout : { pages: [] };
  const pages = safeLayout.pages.map(p => ({ ...p, sections: Array.isArray(p.sections) ? p.sections : [] }));

  const companyName = (store?.storeName || store?.name || store?.metadata?.siteName || 'Company').toString();
  const links = pages.map(pg => ({ text: pg.name || 'Page', pageName: pg.name || 'Home', type: 'page' }));

  const withNavFooter = pages.map(pg => {
    const types = (pg.sections || []).map(s => String(s.type || '').toLowerCase());
    const hasNavbar = types.includes('navbar');
    const hasFooter = types.includes('footer');

    const newSections = [...pg.sections];

    if (!hasNavbar) {
      newSections.unshift({
        id: generateId(),
        type: 'navbar',
        logo: companyName.charAt(0).toUpperCase() + companyName.slice(1),
        links
      });
    }

    if (!hasFooter) {
      newSections.push({
        id: generateId(),
        type: 'footer',
        companyName,
        tagline: 'Powered by JouleAI',
        links: links.map(l => ({ text: l.text, url: `/${(l.pageName || l.text || '').toString().toLowerCase()}` }))
      });
    }

    return { ...pg, sections: newSections };
  });

  return { pages: withNavFooter };
}

function normalizeSection(section) {
  if (!section || typeof section !== 'object') {
    return {
      type: 'textblock',
      id: generateId(),
      heading: 'Content Block',
      content: 'Add your content here'
    };
  }
  
  return {
    id: section.id || generateId(),
    type: section.type || 'textblock',
    ...section
  };
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function attemptRepair(apiKey, modelName, originalPrompt, previous, attempt) {
  try {
    const enhancedPrompt = buildEnhancedPrompt(originalPrompt, {}, attempt + 1);

    const repairPrompt = `REPAIR REQUEST - Your previous response was incomplete or too generic.

${enhancedPrompt}

SPECIFIC ISSUES TO FIX:
- Generate COMPLETE JSON with all required fields
- Ensure each section has unique types (not just hero → features → testimonials)
- Match the website type's specific needs
- Use varied section types from the catalog

Previous attempt (DO NOT COPY THIS - make it different):
${JSON.stringify(previous, null, 2)}

Return COMPLETE, VALID, UNIQUE JSON now.`;

    const repairHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    if (process.env.OPENAI_PROJECT_ID) {
      repairHeaders['OpenAI-Project'] = process.env.OPENAI_PROJECT_ID;
    }
    if (process.env.OPENAI_ORG_ID) {
      repairHeaders['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
    }
    
    const repair = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: repairHeaders,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'user', content: repairPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 1.2,
        top_p: 0.95,
        max_tokens: 4096
      })
    });

    if (!repair.ok) return null;

    const repairData = await repair.json();
    const repairContent = repairData?.choices?.[0]?.message?.content || '';
    const repairedStr = extractJsonString(repairContent);
    return tryParseJsonWithRepairs(repairedStr);
  } catch (e) {
    console.error('Repair attempt failed:', e);
    return null;
  }
}

// Import the new React component generation system
const { generateReactWebsite, generateReactComponent } = require('../utils/reactComponentAI');

// Main AI generation endpoint - Now generates modern React components
router.post('/:storeId/ai-prompt', 
  authMiddleware, 
  ownerCheckMiddleware((req) => req.params.storeId), 
  async (req, res) => {
    console.log('🚀 AI route hit:', {
      storeId: req.params.storeId,
      method: req.method,
      url: req.url,
      hasAuth: !!req.user,
      bodyKeys: Object.keys(req.body || {})
    });
    
    try {
      const { prompt, mode = 'create', components, industry } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Prompt is required' 
        });
      }

      const store = req.store;
      const apiKey = process.env.OPENAI_API_KEY;
      
      console.log('🔍 API Key check:', {
        hasApiKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        hasProjectId: !!process.env.OPENAI_PROJECT_ID,
        hasOrgId: !!process.env.OPENAI_ORG_ID
      });
      
      if (!apiKey) {
        console.error('❌ No OpenAI API key found in environment variables');
        return res.status(500).json({ 
          success: false, 
          message: 'AI generation unavailable - API key not configured' 
        });
      }

      const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      console.log('🎨 Generating modern React website for prompt:', prompt);

      // Determine industry from prompt or use provided industry
      let detectedIndustry = industry || 'ecommerce';
      const promptLower = prompt.toLowerCase();
      
      if (promptLower.includes('saas') || promptLower.includes('software')) {
        detectedIndustry = 'saas';
      } else if (promptLower.includes('portfolio') || promptLower.includes('designer')) {
        detectedIndustry = 'portfolio';
      } else if (promptLower.includes('restaurant') || promptLower.includes('food')) {
        detectedIndustry = 'restaurant';
      } else if (promptLower.includes('agency') || promptLower.includes('marketing')) {
        detectedIndustry = 'agency';
      }

      // Configure website generation
      const websiteConfig = {
        siteName: store.storeName || store.name || 'Your Store',
        industry: detectedIndustry,
        theme: promptLower.includes('dark') ? 'dark' : 'modern',
        components: components || ['navbar', 'hero', 'products', 'features', 'testimonials', 'footer'],
        prompt: prompt
      };

      try {
        // Send immediate response that generation started
        console.log('🚀 Starting React website generation...');
        
        // Generate React components with timeout protection
        const startTime = Date.now();
        
        const reactWebsite = await Promise.race([
          generateReactWebsite(websiteConfig, apiKey, modelName),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Generation timeout after 90 seconds')), 90000)
          )
        ]).catch(async (error) => {
          console.warn(`⚠️ AI generation failed: ${error.message}`);
          console.log('🔄 Using enhanced fallback with templates...');
          
          // Generate dynamic content based on the actual user prompt
          const { COMPONENT_TEMPLATES } = require('../utils/reactComponentTemplates');
          
          // Analyze prompt to generate appropriate content
          const promptLower = prompt.toLowerCase();
          
          // Detect business type and generate content accordingly
          let businessType = 'store';
          let heroTitle = `Welcome to ${websiteConfig.siteName}`;
          let heroSubtitle = 'Discover amazing products and deals';
          let productsTitle = 'Featured Products';
          let products = [];
          let testimonials = [];
          
          // Coffee/Cafe detection
          if (promptLower.includes('coffee') || promptLower.includes('cafe') || promptLower.includes('espresso') || promptLower.includes('bean')) {
            businessType = 'coffee shop';
            heroTitle = `Premium Coffee Experience`;
            heroSubtitle = 'Artisan roasted beans and handcrafted beverages';
            productsTitle = 'Our Coffee Selection';
            products = [
              { id: 1, name: 'Ethiopian Single Origin', price: '$24', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=300', rating: 5, description: 'Bright, floral notes with citrus undertones' },
              { id: 2, name: 'House Blend Espresso', price: '$22', image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=300', rating: 5, description: 'Rich, full-bodied blend perfect for espresso' },
              { id: 3, name: 'Colombian Dark Roast', price: '$26', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=300', rating: 4, description: 'Bold, chocolatey flavor with smoky finish' }
            ];
            testimonials = [
              { name: 'Maria S.', text: 'The best coffee in town! The Ethiopian blend is absolutely divine.', rating: 5 },
              { name: 'David L.', text: 'Perfect espresso every time. Love the cozy atmosphere.', rating: 5 },
              { name: 'Sarah W.', text: 'Amazing quality beans and friendly baristas. Highly recommend!', rating: 5 }
            ];
          }
          // Cars/Automotive detection
          else if (promptLower.includes('car') || promptLower.includes('auto') || promptLower.includes('vehicle') || promptLower.includes('dealership')) {
            businessType = 'automotive';
            heroTitle = 'Premium Automotive Solutions';
            heroSubtitle = 'Quality vehicles and professional service you can trust';
            productsTitle = 'Featured Vehicles';
            products = [
              { id: 1, name: '2024 Luxury Sedan', price: '$45,999', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400', rating: 5, description: 'Premium comfort and advanced technology' },
              { id: 2, name: 'Electric SUV', price: '$52,999', image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400', rating: 5, description: 'Eco-friendly performance with luxury features' },
              { id: 3, name: 'Sport Coupe', price: '$38,999', image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400', rating: 4, description: 'Thrilling performance and sleek design' }
            ];
            testimonials = [
              { name: 'John D.', text: 'Excellent service and fair prices. Found my dream car here!', rating: 5 },
              { name: 'Lisa K.', text: 'Professional team helped me through the entire process seamlessly.', rating: 5 },
              { name: 'Mike R.', text: 'Great selection of quality vehicles. Highly recommend this dealership!', rating: 5 }
            ];
          }
          // Fashion/Clothing detection
          else if (promptLower.includes('fashion') || promptLower.includes('clothing') || promptLower.includes('apparel') || promptLower.includes('boutique')) {
            businessType = 'fashion store';
            heroTitle = 'Fashion Forward Style';
            heroSubtitle = 'Discover the latest trends and timeless classics';
            productsTitle = 'New Arrivals';
            products = [
              { id: 1, name: 'Designer Jacket', price: '$199', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400', rating: 5, description: 'Premium quality with contemporary style' },
              { id: 2, name: 'Casual Sneakers', price: '$129', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400', rating: 5, description: 'Comfortable and trendy for everyday wear' },
              { id: 3, name: 'Elegant Dress', price: '$159', image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', rating: 4, description: 'Perfect for special occasions and events' }
            ];
            testimonials = [
              { name: 'Emma T.', text: 'Love the quality and style! Always find something perfect here.', rating: 5 },
              { name: 'Alex P.', text: 'Great customer service and amazing fashion pieces.', rating: 5 },
              { name: 'Sophie M.', text: 'My go-to store for trendy and affordable fashion.', rating: 5 }
            ];
          }
          // Tech/Electronics detection
          else if (promptLower.includes('tech') || promptLower.includes('electronics') || promptLower.includes('gadget') || promptLower.includes('smartphone')) {
            businessType = 'tech store';
            heroTitle = 'Cutting-Edge Technology';
            heroSubtitle = 'Latest gadgets and innovative solutions for modern life';
            productsTitle = 'Tech Essentials';
            products = [
              { id: 1, name: 'Wireless Headphones', price: '$299', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', rating: 5, description: 'Premium sound quality with noise cancellation' },
              { id: 2, name: 'Smart Watch', price: '$399', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', rating: 5, description: 'Advanced health tracking and connectivity features' },
              { id: 3, name: 'Laptop Stand', price: '$79', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400', rating: 4, description: 'Ergonomic design for better productivity' }
            ];
            testimonials = [
              { name: 'Ryan B.', text: 'Top-notch tech products with excellent customer support!', rating: 5 },
              { name: 'Jessica H.', text: 'Found exactly what I needed. Great prices and fast shipping.', rating: 5 },
              { name: 'Tom C.', text: 'Quality products and knowledgeable staff. Highly satisfied!', rating: 5 }
            ];
          }
          // Restaurant/Food detection
          else if (promptLower.includes('restaurant') || promptLower.includes('food') || promptLower.includes('dining') || promptLower.includes('cuisine')) {
            businessType = 'restaurant';
            heroTitle = 'Exceptional Dining Experience';
            heroSubtitle = 'Fresh ingredients, authentic flavors, memorable moments';
            productsTitle = 'Signature Dishes';
            products = [
              { id: 1, name: 'Chef\'s Special Pasta', price: '$28', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400', rating: 5, description: 'Handmade pasta with seasonal ingredients' },
              { id: 2, name: 'Grilled Salmon', price: '$32', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400', rating: 5, description: 'Fresh Atlantic salmon with herbs and vegetables' },
              { id: 3, name: 'Artisan Pizza', price: '$24', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400', rating: 4, description: 'Wood-fired pizza with premium toppings' }
            ];
            testimonials = [
              { name: 'Maria R.', text: 'Absolutely delicious food and wonderful atmosphere!', rating: 5 },
              { name: 'James K.', text: 'Best dining experience in the city. Highly recommend!', rating: 5 },
              { name: 'Anna S.', text: 'Amazing flavors and excellent service. Will definitely return!', rating: 5 }
            ];
          }
          // Default/Generic store
          else {
            products = [
              { id: 1, name: 'Premium Product', price: '$99', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', rating: 5, description: 'High-quality product with amazing features' },
              { id: 2, name: 'Popular Choice', price: '$79', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', rating: 4, description: 'Customer favorite with excellent reviews' },
              { id: 3, name: 'New Arrival', price: '$119', image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400', rating: 5, description: 'Latest addition to our collection' }
            ];
            testimonials = [
              { name: 'Sarah J.', text: 'Amazing quality and service! Highly recommend.', rating: 5 },
              { name: 'Mike C.', text: 'Best purchase I\'ve made this year. Great value for money!', rating: 5 },
              { name: 'Emma D.', text: 'Outstanding customer support and fast delivery.', rating: 5 }
            ];
          }
          
          console.log(`🎯 Detected business type: ${businessType} from prompt: "${prompt}"`);
          
          return {
            siteName: websiteConfig.siteName,
            industry: detectedIndustry,
            theme: websiteConfig.theme,
            componentOrder: ['navbar', 'hero', 'products', 'testimonials', 'footer'],
            components: {
              navbar: { 
                type: 'navbar', 
                code: COMPONENT_TEMPLATES.navbar.example,
                content: { logo: websiteConfig.siteName, businessType },
                isTemplate: true
              },
              hero: { 
                type: 'hero', 
                code: COMPONENT_TEMPLATES.hero.example,
                content: { title: heroTitle, subtitle: heroSubtitle, businessType },
                isTemplate: true
              },
              products: { 
                type: 'products', 
                code: COMPONENT_TEMPLATES.products.example,
                content: { 
                  title: productsTitle,
                  products: products,
                  items: products // Also add as items for compatibility
                },
                isTemplate: true
              },
              testimonials: {
                type: 'testimonials',
                code: '// Testimonials component with customer reviews',
                content: {
                  title: 'What Our Customers Say',
                  testimonials: testimonials,
                  items: testimonials // Also add as items for compatibility
                },
                isTemplate: true
              },
              footer: {
                type: 'footer',
                code: '// Footer component with company info',
                content: { companyName: websiteConfig.siteName, businessType },
                isTemplate: true
              }
            },
            generatedAt: new Date().toISOString(),
            metadata: {
              totalComponents: 5,
              generationTime: Date.now() - startTime,
              apiModel: 'prompt-based-generation',
              usedFallback: true,
              detectedBusinessType: businessType,
              originalPrompt: prompt
            }
          };
        });
        
        const generationTime = Date.now() - startTime;
        console.log(`✅ React website generated in ${generationTime}ms ${reactWebsite.metadata?.usedFallback ? '(with template fallback)' : ''}`);
        
        
        // Convert React components to layout structure for compatibility
        const pages = [{
          name: 'Home',
          path: '/',
          description: 'Main homepage',
          sections: reactWebsite.componentOrder.map(componentType => {
            const component = reactWebsite.components[componentType];
            return {
              id: `${componentType}-${Date.now()}`,
              type: componentType,
              reactComponent: {
                code: component.code,
                props: component.content,
                variant: component.variant,
                theme: component.theme,
                generated: true,
                isTemplate: component.isTemplate || false
              },
              // Legacy compatibility fields
              ...component.content
            };
          })
        }];

        // Add additional pages
        if (detectedIndustry === 'ecommerce') {
          pages.push(
            {
              name: 'Products',
              path: '/products',
              description: 'Product catalog',
              sections: [{
                id: `products-page-${Date.now()}`,
                type: 'products',
                title: 'All Products',
                showFilters: true,
                reactComponent: {
                  generated: true,
                  type: 'products'
                }
              }]
            },
            {
              name: 'About',
              path: '/about',
              description: 'About us page',
              sections: [{
                id: `about-${Date.now()}`,
                type: 'textblock',
                title: 'About Us',
                content: `Learn more about ${websiteConfig.siteName} and our mission to provide exceptional products and service.`
              }]
            },
            {
              name: 'Contact',
              path: '/contact',
              description: 'Contact information',
              sections: [{
                id: `contact-${Date.now()}`,
                type: 'contact',
                title: 'Get in Touch',
                subtitle: 'We\'d love to hear from you'
              }]
            }
          );
        }

        const normalized = {
          theme: {
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af', 
            accentColor: '#f59e0b',
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            bannerUrl: '',
            logoUrl: '',
            fonts: 'Inter, system-ui, sans-serif',
            stylePreset: websiteConfig.theme,
            borderRadius: 'lg',
            shadow: 'soft',
            layoutPattern: 'modern-react'
          },
          layout: { pages },
          metadata: {
            siteName: websiteConfig.siteName,
            description: `Modern ${detectedIndustry} website generated with AI`,
            industry: detectedIndustry,
            generatedWith: 'react-components',
            totalComponents: Object.keys(reactWebsite.components).length,
            generatedAt: reactWebsite.generatedAt
          },
          reactWebsite: reactWebsite // Store the full React website data
        };

        const updated = await Store.findByIdAndUpdate(
          store._id,
          {
            theme: normalized.theme,
            layout: normalized.layout,
            metadata: normalized.metadata,
            reactWebsite: reactWebsite // Store React components data
          },
          { new: true }
        );

        console.log(`✓ Store ${store._id} updated successfully with React components`);
        console.log(`  - Pages: ${pages.length}`);
        console.log(`  - React Components: ${Object.keys(reactWebsite.components).length}`);
        console.log(`  - Components: ${reactWebsite.componentOrder.join(', ')}`);
        console.log(`  - Industry: ${detectedIndustry}`);
        console.log(`  - Theme: ${websiteConfig.theme}`);

        return res.json({ 
          success: true, 
          data: { 
            store: updated,
            generated: {
              pageCount: pages.length,
              componentCount: Object.keys(reactWebsite.components).length,
              components: reactWebsite.componentOrder,
              industry: detectedIndustry,
              theme: websiteConfig.theme,
              generationType: 'react-components',
              pages: pages.map(p => ({ 
                name: p.name, 
                path: p.path,
                sectionCount: p.sections.length,
                hasReactComponents: p.sections.some(s => s.reactComponent)
              }))
            },
            reactWebsite: {
              siteName: reactWebsite.siteName,
              totalComponents: reactWebsite.metadata.totalComponents,
              generatedAt: reactWebsite.generatedAt,
              components: Object.keys(reactWebsite.components)
            }
          } 
        });

      } catch (generationError) {
        console.error('❌ React website generation failed:', generationError);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate React components. Please try again.',
          error: generationError.message
        });
      }

    } catch (error) {
      console.error('AI generation error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate store design. Please try again.' 
      });
    }
  }
);

// Generate individual React component
router.post('/:storeId/generate-component', 
  authMiddleware,
  ownerCheckMiddleware((req) => req.params.storeId),
  async (req, res) => {
    try {
      const { componentType, content = {}, options = {} } = req.body;
      const apiKey = process.env.OPENAI_API_KEY;
      const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      if (!componentType) {
        return res.status(400).json({
          success: false,
          message: 'Component type is required'
        });
      }

      console.log(`🎨 Generating individual ${componentType} component`);

      const component = await generateReactComponent(
        componentType,
        content,
        { ...options, apiKey, modelName }
      );

      return res.json({
        success: true,
        data: {
          component,
          generated: {
            type: component.type,
            codeLength: component.code.length,
            variant: component.variant,
            theme: component.theme,
            isTemplate: component.isTemplate || false
          }
        }
      });

    } catch (error) {
      console.error('❌ Component generation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate component. Please try again.',
        error: error.message
      });
    }
  }
);

// Get React website data
router.get('/:storeId/react-website',
  authMiddleware,
  ownerCheckMiddleware((req) => req.params.storeId),
  async (req, res) => {
    try {
      const store = req.store;
      
      if (!store.reactWebsite) {
        return res.status(404).json({
          success: false,
          message: 'No React website generated for this store'
        });
      }

      return res.json({
        success: true,
        data: {
          reactWebsite: store.reactWebsite,
          metadata: store.metadata
        }
      });

    } catch (error) {
      console.error('❌ Error fetching React website:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch React website data'
      });
    }
  }
);

// Generate preview HTML for React components
router.get('/:storeId/preview',
  (req, res, next) => {
    // Handle token from query param for iframe requests
    if (req.query.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  authMiddleware,
  ownerCheckMiddleware((req) => req.params.storeId),
  async (req, res) => {
    try {
      const store = req.store;
      
      if (!store.layout || !store.layout.pages) {
        return res.status(404).json({
          success: false,
          message: 'No website layout found for preview'
        });
      }

      // Generate a preview HTML page that can render the React components
      const serializedStoreData = serializeForScriptTag({
        name: store.metadata?.siteName || store.storeName,
        layout: store.layout,
        theme: store.theme,
        reactWebsite: store.reactWebsite
      });

      const previewHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${store.metadata?.siteName || store.storeName || 'Preview'}</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
      .preview-container { min-height: 100vh; background: #f9fafb; }
      .preview-section { margin-bottom: 0; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script id="store-data" type="application/json">${serializedStoreData}</script>
    
    <script type="text/babel">
      const { useState, useEffect } = React;
      const { createRoot } = ReactDOM;
      
      // Store data
      const storeData = JSON.parse(document.getElementById('store-data').textContent);
      
      // Simple section renderer
      const SectionRenderer = ({ section }) => {
        const sectionStyle = {
          backgroundColor: section.bgColor || (section.type === 'hero' ? '#f3f4f6' : '#ffffff'),
          color: section.textColor || '#1f2937',
          padding: section.type === 'navbar' ? '0' : '4rem 2rem',
          minHeight: section.type === 'hero' ? '80vh' : 'auto',
          display: section.type === 'hero' ? 'flex' : 'block',
          alignItems: section.type === 'hero' ? 'center' : 'normal',
          justifyContent: section.type === 'hero' ? 'center' : 'normal'
        };
        
        const renderContent = () => {
          switch (section.type) {
            case 'navbar':
              return (
                <nav style={{ 
                  background: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(10px)',
                  borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
                  color: '#1f2937', 
                  padding: '1rem 2rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  position: 'sticky',
                  top: '0',
                  zIndex: '50',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white', 
                      fontWeight: 'bold',
                      fontSize: '1.2rem'
                    }}>
                      {storeData.name[0]?.toUpperCase() || 'S'}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '900', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {storeData.name}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <a href="#" style={{ 
                        color: '#1f2937', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        position: 'relative',
                        transition: 'color 0.2s'
                      }}>Home</a>
                      <a href="#" style={{ 
                        color: '#1f2937', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        position: 'relative',
                        transition: 'color 0.2s'
                      }}>Products</a>
                      <a href="#" style={{ 
                        color: '#1f2937', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        position: 'relative',
                        transition: 'color 0.2s'
                      }}>Categories</a>
                      <a href="#" style={{ 
                        color: '#1f2937', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        position: 'relative',
                        transition: 'color 0.2s'
                      }}>About</a>
                      <a href="#" style={{ 
                        color: '#1f2937', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        position: 'relative',
                        transition: 'color 0.2s'
                      }}>Contact</a>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {/* Search Icon */}
                      <button style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}>
                        🔍
                      </button>
                      
                      {/* User Account */}
                      <button style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}>
                        👤
                      </button>
                      
                      {/* Shopping Cart */}
                      <button style={{
                        position: 'relative',
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}>
                        🛒
                        <span style={{
                          position: 'absolute',
                          top: '0',
                          right: '0',
                          width: '20px',
                          height: '20px',
                          backgroundColor: '#ef4444',
                          borderRadius: '50%',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'translate(25%, -25%)'
                        }}>
                          3
                        </span>
                      </button>
                      
                      {/* CTA Button */}
                      <button style={{
                        background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 6px rgba(59, 130, 246, 0.25)'
                      }}>
                        Sign In
                      </button>
                    </div>
                  </div>
                </nav>
              );
              
            case 'hero':
              return (
                <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                  <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '1rem', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {section.title || section.reactComponent?.content?.title || \`Welcome to \${storeData.name}\`}
                  </h1>
                  <p style={{ fontSize: '1.25rem', color: '#6b7280', marginBottom: '2rem' }}>
                    {section.subtitle || section.reactComponent?.content?.subtitle || 'Discover amazing products and exceptional service'}
                  </p>
                  <button style={{ background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Explore Now
                  </button>
                </div>
              );
              
            case 'products':
              return (
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem', color: '#1f2937' }}>
                      {section.title || 'Featured Products'}
                    </h2>
                    <p style={{ fontSize: '1.125rem', color: '#6b7280', maxWidth: '600px', margin: '0 auto' }}>
                      Discover our carefully curated selection of premium products
                    </p>
                  </div>
                  
                  {/* Filter Tabs */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.75rem' }}>
                      {['All', 'Featured', 'New Arrivals', 'Best Sellers'].map((tab, idx) => (
                        <button key={tab} style={{
                          padding: '0.75rem 1.5rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          fontWeight: '600',
                          cursor: 'pointer',
                          backgroundColor: idx === 0 ? '#3b82f6' : 'transparent',
                          color: idx === 0 ? 'white' : '#6b7280'
                        }}>
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {[
                      { name: 'Premium Wireless Headphones', price: '$199', originalPrice: '$249', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', rating: 5, reviews: 128, badge: 'Best Seller' },
                      { name: 'Smart Fitness Watch', price: '$299', originalPrice: '$399', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', rating: 5, reviews: 89, badge: 'New' },
                      { name: 'Professional Camera Lens', price: '$899', image: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400', rating: 4, reviews: 67 },
                      { name: 'Minimalist Backpack', price: '$129', originalPrice: '$179', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', rating: 5, reviews: 203, badge: 'Popular' }
                    ].map((product, i) => (
                      <div key={i} style={{
                        background: 'white',
                        borderRadius: '1.5rem',
                        padding: '1.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                        border: '1px solid #f3f4f6',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-4px)';
                        e.target.style.boxShadow = '0 20px 25px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                      }}>
                        <div style={{ position: 'relative', marginBottom: '1rem' }}>
                          <img src={product.image} alt={product.name} style={{
                            width: '100%',
                            height: '240px',
                            objectFit: 'cover',
                            borderRadius: '1rem'
                          }} />
                          {product.badge && (
                            <span style={{
                              position: 'absolute',
                              top: '1rem',
                              left: '1rem',
                              backgroundColor: product.badge === 'New' ? '#10b981' : product.badge === 'Best Seller' ? '#f59e0b' : '#8b5cf6',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {product.badge}
                            </span>
                          )}
                          <button style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}>
                            ♡
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex' }}>
                            {[...Array(5)].map((_, starIdx) => (
                              <span key={starIdx} style={{ color: starIdx < product.rating ? '#fbbf24' : '#d1d5db', fontSize: '1rem' }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>({product.reviews})</span>
                        </div>
                        
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', color: '#1f2937' }}>{product.name}</h3>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#3b82f6' }}>{product.price}</span>
                          {product.originalPrice && (
                            <span style={{ fontSize: '1rem', color: '#9ca3af', textDecoration: 'line-through' }}>{product.originalPrice}</span>
                          )}
                          {product.originalPrice && (
                            <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '600' }}>
                              Save ${parseInt(product.originalPrice.slice(1)) - parseInt(product.price.slice(1))}
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button style={{
                            flex: '1',
                            background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                            color: 'white',
                            padding: '0.875rem',
                            border: 'none',
                            borderRadius: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'transform 0.2s'
                          }}>
                            🛒 Add to Cart
                          </button>
                          <button style={{
                            padding: '0.875rem',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            👁️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              
            case 'testimonials':
              return (
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                  <h2 style={{ textAlign: 'center', fontSize: '2.5rem', fontWeight: '900', marginBottom: '3rem' }}>
                    {section.title || 'What Our Customers Say'}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {['Sarah Johnson', 'Mike Chen'].map((name, i) => (
                      <div key={i} style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', marginBottom: '1rem' }}>
                          {[1,2,3,4,5].map(star => <span key={star} style={{ color: '#fbbf24', fontSize: '1.25rem' }}>★</span>)}
                        </div>
                        <p style={{ fontStyle: 'italic', marginBottom: '1rem', color: '#4b5563' }}>
                          "Amazing products and exceptional service! Highly recommend."
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{name}</div>
                            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Verified Customer</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              
            case 'footer':
              return (
                <footer style={{ background: '#1f2937', color: 'white', padding: '3rem 2rem 1rem' }}>
                  <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{storeData.name}</h3>
                      <p style={{ color: '#9ca3af' }}>Your trusted partner for quality products and exceptional service.</p>
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Quick Links</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>About Us</a>
                        <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Products</a>
                        <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Contact</a>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #374151', marginTop: '2rem', paddingTop: '1rem', textAlign: 'center', color: '#9ca3af' }}>
                    © 2024 {storeData.name}. All rights reserved.
                  </div>
                </footer>
              );
              
            default:
              return (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{section.title || section.type}</h2>
                  <p style={{ color: '#6b7280' }}>{section.subtitle || section.content || 'Content section'}</p>
                </div>
              );
          }
        };
        
        return (
          <section className="preview-section" style={sectionStyle}>
            {renderContent()}
          </section>
        );
      };
      
      // Main App component
      const App = () => {
        const homePage = storeData.layout.pages.find(p => p.name === 'Home') || storeData.layout.pages[0];
        const sections = homePage?.sections || [];
        
        return (
          <div className="preview-container">
            {sections.map((section, index) => (
              <SectionRenderer key={section.id || index} section={section} />
            ))}
          </div>
        );
      };
      
      // Render the app
      const root = createRoot(document.getElementById('root'));
      root.render(<App />);
    </script>
</body>
</html>`;

      // Set content type to HTML and return the preview
      res.setHeader('Content-Type', 'text/html');
      return res.send(previewHTML);

    } catch (error) {
      console.error('❌ Error generating preview:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate preview'
      });
    }
  }
);

module.exports = router;
