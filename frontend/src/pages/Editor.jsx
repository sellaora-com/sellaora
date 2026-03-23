import { useEffect, useState, useCallback } from 'react';
import PageTabs from '../components/editor/PageTabs';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import ComponentLibrary from '../components/editor/ComponentLibrary';
import Canvas from '../components/editor/Canvas';
import PropertiesPanel from '../components/editor/PropertiesPanel';
import TopBar from '../components/editor/TopBar';
import StorePreview from '../components/store/StorePreview';
import { storeAPI } from '../utils/api';

const Editor = () => {
  const { themeId, storeId } = useParams();
  const navigate = useNavigate();
  const [components, setComponents] = useState([]);
  const [componentsByPage, setComponentsByPage] = useState({});
  const [pages, setPages] = useState([]); // [{id,name}]
  const [currentPage, setCurrentPage] = useState(0);
  const [htmlContent, setHtmlContent] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState({});
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [productList, setProductList] = useState([]);
  const location = useLocation();
  const [storeName, setStoreName] = useState('');
  const [aiPreview, setAiPreview] = useState(null); // { theme, layout }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const loadEditor = async () => {
      try {
        const effectiveStoreId = storeId || localStorage.getItem('editorStoreId');
        // Persist so any subsequent actions (save, navigation) target the same store
        if (effectiveStoreId) {
          localStorage.setItem('editorStoreId', effectiveStoreId);
        }
        if (!effectiveStoreId) {
          // fallback to mock
          setComponents([]);
          setHistory([[]]);
          setHistoryIndex(0);
          return;
        }

        const body = await storeAPI.getEditorData(effectiveStoreId);
        const payload = body.data;
        const incomingProducts = Array.isArray(payload.products) ? payload.products : [];
        setProductList(incomingProducts);

        // Pull theme for consistent look with AI preview
        const themeFromStore = (payload.store && payload.store.theme) ? payload.store.theme : {};
        setTheme(themeFromStore || {});

        if (payload.store && payload.store.storeName) {
          setStoreName(payload.store.storeName);
        }
        // Attempt to use parsed layout -> components, otherwise default to empty
        let comps = [];
        const pageList = [];
        const byPage = {};
        try {
          const primary = themeFromStore?.primaryColor || '#2563eb';
          const bg = themeFromStore?.backgroundColor || '#ffffff';
          const text = themeFromStore?.textColor || '#111827';
          const normalizeSection = (s, idx) => {
            const t = String(s.type || '').toLowerCase();
            const id = `${t || 'section'}-${idx}`;
            // Map AI/preview types into editor canonical shapes
            if (t === 'navbar') {
              return {
                id,
                type: 'navbar',
                props: {
                  logo: s.logo || 'Logo',
                  links: Array.isArray(s.links)
                    ? s.links.map(l => ({
                        text: l.text || 'Link',
                        type: l.type || (l.pageName ? 'page' : 'external'),
                        pageName: l.pageName || '',
                        url: l.url || (l.pageName ? '' : '#'),
                      }))
                    : [
                        { text: 'Home', type: 'page', pageName: 'Home' },
                        { text: 'Products', type: 'external', url: '#' },
                        { text: 'About', type: 'external', url: '#' },
                      ],
                  bgColor: s.bgColor || bg,
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'hero' || t.includes('hero')) {
              return {
                id,
                type: 'hero',
                props: {
                  title: s.title || s.heading || 'New Hero Section',
                  subtitle: s.subtitle || s.subheading || 'Add your subtitle here',
                  buttonText: s.buttonText || 'Click Me',
                  buttonLink: s.buttonLink || '#',
                  bgColor: s.bgColor || primary,
                  textColor: s.textColor || '#ffffff',
                  image: s.image || s.imageUrl || s.backgroundUrl || '',
                }
              };
            }
            if (t === 'features' || t === 'featuredproducts') {
              const items = Array.isArray(s.items) ? s.items : Array.isArray(s.features) ? s.features : [];
              return {
                id,
                type: 'features',
                props: {
                  title: s.title || 'Features Section',
                  items: (items.length ? items : [
                    { icon: '⭐', title: 'Feature 1', description: 'Description here' },
                    { icon: '🎯', title: 'Feature 2', description: 'Description here' },
                    { icon: '🚀', title: 'Feature 3', description: 'Description here' },
                  ]).map(it => ({ icon: it.icon || '⭐', title: it.title || 'Feature', description: it.description || 'Description here' })),
                  bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0f172a' : '#f9fafb'),
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'collection' || t.includes('product-grid')) {
              return {
                id,
                type: 'collection',
                props: {
                  title: s.title || 'Our Collection',
                  items: (Array.isArray(s.items) ? s.items : [
                    { name: 'Product 1', price: '$19', image: 'https://picsum.photos/seed/p1/300/200', description: 'Great product' },
                    { name: 'Product 2', price: '$29', image: 'https://picsum.photos/seed/p2/300/200', description: 'Amazing quality' },
                    { name: 'Product 3', price: '$39', image: 'https://picsum.photos/seed/p3/300/200', description: 'Best seller' },
                  ]).map(item => ({
                    name: item.name || item.title || 'Product',
                    price: item.price || '$0',
                    image: item.image || 'https://picsum.photos/seed/default/300/200',
                    description: item.description || 'Product description'
                  })),
                  bgColor: s.bgColor || bg,
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'categories-visual' || t.includes('categories')) {
              const cats = Array.isArray(s.categories) ? s.categories : [];
              return {
                id,
                type: 'collection',
                props: {
                  title: s.title || 'Categories',
                  items: cats.map(c => ({ title: c.name || c.title, price: '', image: c.imageUrl || c.image || 'https://picsum.photos/seed/cat/300/200' })),
                  bgColor: s.bgColor || bg,
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'instagram-feed' || t.includes('instagram')) {
              const count = s.numberOfPosts || 6;
              return {
                id,
                type: 'gallery',
                props: {
                  title: s.title || 'Instagram',
                  columns: 3,
                  images: Array.from({ length: Math.min(12, Math.max(1, count)) }).map((_, i) => `https://picsum.photos/seed/insta-${s.username || 'feed'}-${i}/400/300`),
                }
              };
            }
            if (t === 'testimonials') {
              return {
                id,
                type: 'testimonials',
                props: {
                  title: s.title || 'What customers say',
                  items: (Array.isArray(s.items) ? s.items : [
                    { name: 'Alex', rating: 5, text: 'Amazing products!', avatar: 'https://picsum.photos/seed/alex/100/100' },
                    { name: 'Sam', rating: 5, text: 'Great support and fast delivery.', avatar: 'https://picsum.photos/seed/sam/100/100' },
                  ]).map(item => ({
                    name: item.name || item.author || 'Customer',
                    rating: item.rating || 5,
                    text: item.text || item.quote || 'Great experience!',
                    avatar: item.avatar || `https://picsum.photos/seed/${item.name || 'user'}/100/100`
                  })),
                  bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0f172a' : '#f9fafb'),
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'pricing') {
              return {
                id,
                type: 'pricing',
                props: {
                  title: s.title || 'Pricing Plans',
                  items: (Array.isArray(s.items) ? s.items : [
                    { name: 'Basic', price: '$9/mo', features: ['Feature A', 'Feature B'], buttonText: 'Get Started' },
                    { name: 'Pro', price: '$29/mo', features: ['Everything in Basic', 'Feature C'], buttonText: 'Choose Pro', featured: true },
                  ]).map(item => ({
                    name: item.name || 'Plan',
                    price: item.price || '$0',
                    features: Array.isArray(item.features) ? item.features : ['Feature 1', 'Feature 2'],
                    buttonText: item.buttonText || 'Choose Plan',
                    featured: item.featured || false
                  })),
                  bgColor: s.bgColor || bg,
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'cta') {
              return {
                id,
                type: 'cta',
                props: {
                  heading: s.title || s.heading || 'Ready to get started?',
                  subheading: s.subtitle || s.subheading || 'Join us today',
                  buttonText: s.buttonText || 'Get Started',
                  buttonLink: s.buttonLink || '#',
                  linkType: 'external',
                  pageName: '',
                  bgColor: s.bgColor || primary,
                  textColor: s.textColor || '#ffffff',
                }
              };
            }
            if (t === 'gallery') {
              return {
                id,
                type: 'gallery',
                props: {
                  title: s.title || 'Image Gallery',
                  columns: 3,
                  images: Array.isArray(s.images) 
                    ? s.images.map(img => typeof img === 'string' ? img : (img.url || img))
                    : ['https://picsum.photos/seed/1/400/300', 'https://picsum.photos/seed/2/400/300', 'https://picsum.photos/seed/3/400/300'],
                  bgColor: s.bgColor || bg,
                  textColor: s.textColor || text,
                }
              };
            }
            if (t === 'newsletter') {
              return {
                id,
                type: 'newsletter',
                props: {
                  title: s.title || 'Join our newsletter',
                  description: s.subtitle || s.description || 'Get updates in your inbox.',
                  placeholder: 'you@example.com',
                  ctaText: s.buttonText || 'Subscribe',
                  bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0b1220' : '#f3f4f6'),
                  textColor: s.textColor || '#1f2937',
                }
              };
            }
            if (t === 'footer') {
              return {
                id,
                type: 'footer',
                props: {
                  companyName: s.companyName || 'Company Name',
                  tagline: s.tagline || 'Your company tagline',
                  links: (Array.isArray(s.links) ? s.links : [
                    { text: 'Home', url: '#' },
                    { text: 'About', url: '#' },
                    { text: 'Contact', url: '#' },
                  ]).map(l => ({ text: l.text || 'Link', url: l.url || '#' })),
                  bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0b1220' : '#1f2937'),
                  textColor: s.textColor || '#f3f4f6',
                }
              };
            }
            // default: preserve unknown type and pass through properties so AutoSection can render it
            return {
              id,
              type: t || 'custom',
              props: {
                ...Object.keys(s || {}).reduce((acc, key) => {
                  if (key !== 'id' && key !== 'type') acc[key] = s[key];
                  return acc;
                }, {}),
              }
            };
          };

          if (payload.layout && Array.isArray(payload.layout.pages)) {
            payload.layout.pages.forEach((pg, pidx) => {
              const name = pg.name || `Page ${pidx + 1}`;
              pageList.push({ id: `page-${pidx}`, name });
              byPage[name] = Array.isArray(pg.sections) ? pg.sections.map((s, idx) => normalizeSection(s, idx)) : [];
            });
          } else if (payload.layout && Array.isArray(payload.layout.sections)) {
            // Single-page fallback
            comps = payload.layout.sections.map((s, idx) => normalizeSection(s, idx));
            pageList.push({ id: 'page-0', name: 'Home' });
            byPage['Home'] = comps;
          }
        } catch {
          comps = [];
        }

        // htmlContent may be provided by backend (AI generated or saved)
        // Sometimes htmlContent is actually a JSON stringified layout. Detect that and convert it to components.
        let rawHtml = payload.htmlContent || null;
        if (rawHtml) {
          const trimmed = rawHtml.trim();
          // Try direct JSON parse if it looks like JSON
          let parsedJson = null;
          try {
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              parsedJson = JSON.parse(trimmed);
            } else {
              // Try to extract JSON embedded inside HTML (e.g. <div>JSON</div>)
              const firstIdx = Math.min(
                ...( [trimmed.indexOf('{'), trimmed.indexOf('[')].filter(i => i >= 0)
              ));
              if (!Number.isNaN(firstIdx) && firstIdx >= 0) {
                const lastIdx = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
                if (lastIdx > firstIdx) {
                  const candidate = trimmed.slice(firstIdx, lastIdx + 1);
                  parsedJson = JSON.parse(candidate);
                }
              }
            }
          } catch {
            parsedJson = null;
          }

          if (parsedJson && parsedJson.sections && Array.isArray(parsedJson.sections)) {
            // Use parsed sections as components and do not render iframe
            comps = parsedJson.sections.map((s, idx) => ({ id: `${s.type || 'section'}-${idx}`, type: s.type || 'textblock', props: s }));
            rawHtml = null;
          }
        }

        setHtmlContent(rawHtml);

        if (pageList.length) {
          setPages(pageList);
          setComponentsByPage(byPage);
          const initialName = pageList[0].name;
          const initialComps = byPage[initialName] || [];
          setComponents(initialComps);
          setHistory([JSON.parse(JSON.stringify(initialComps))]);
          setHistoryIndex(0);
          setCurrentPage(0);
        } else {
          setPages([{ id: 'page-0', name: 'Home' }]);
          setComponentsByPage({ Home: comps });
          setComponents(comps);
          setHistory([JSON.parse(JSON.stringify(comps))]);
          setHistoryIndex(0);
          setCurrentPage(0);
        }
      } catch (error) {
        console.error('Load editor failed', error);
        setComponents([]);
        setHistory([[]]);
        setHistoryIndex(0);
      }
    };

    loadEditor();
  }, [storeId, themeId]);

  const saveToHistory = useCallback((newComponents) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newComponents)));
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    setIsDirty(true);
  }, [historyIndex]);

  // Hydrate the builder state from an AI layout so editing matches the preview exactly
  const hydrateFromLayout = (incomingLayout, themeFromStore = {}) => {
    if (!incomingLayout) return;

    const primary = themeFromStore?.primaryColor || '#2563eb';
    const bg = themeFromStore?.backgroundColor || '#ffffff';
    const text = themeFromStore?.textColor || '#111827';

    const normalizeSection = (s, idx) => {
      const t = String(s?.type || '').toLowerCase();
      const id = `${t || 'section'}-${idx}`;
      if (t === 'navbar') {
        return {
          id,
          type: 'navbar',
          props: {
            logo: s.logo || 'Logo',
            links: Array.isArray(s.links)
              ? s.links.map(l => ({
                  text: l.text || 'Link',
                  type: l.type || (l.pageName ? 'page' : 'external'),
                  pageName: l.pageName || '',
                  url: l.url || (l.pageName ? '' : '#'),
                }))
              : [
                  { text: 'Home', type: 'page', pageName: 'Home' },
                  { text: 'Products', type: 'external', url: '#' },
                  { text: 'About', type: 'external', url: '#' },
                ],
            bgColor: s.bgColor || bg,
            textColor: s.textColor || text,
          }
        };
      }
      if (t === 'hero' || t.includes('hero')) {
        return { id, type: 'hero', props: { title: s.title || s.heading || 'New Hero Section', subtitle: s.subtitle || s.subheading || 'Add your subtitle here', buttonText: s.buttonText || 'Click Me', buttonLink: s.buttonLink || '#', bgColor: s.bgColor || primary, textColor: s.textColor || '#ffffff', image: s.image || s.imageUrl || s.backgroundUrl || '' } };
      }
      if (t === 'features' || t === 'featuredproducts') {
        const items = Array.isArray(s.items) ? s.items : Array.isArray(s.features) ? s.features : [];
        return { id, type: 'features', props: { title: s.title || 'Features Section', items: (items.length ? items : [ { icon: '⭐', title: 'Feature 1', description: 'Description here' }, { icon: '🎯', title: 'Feature 2', description: 'Description here' }, { icon: '🚀', title: 'Feature 3', description: 'Description here' }, ]).map(it => ({ icon: it.icon || '⭐', title: it.title || 'Feature', description: it.description || 'Description here' })), bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0f172a' : '#f9fafb'), textColor: s.textColor || text } };
      }
      if (t === 'collection' || t.includes('product-grid')) {
        return { id, type: 'collection', props: { title: s.title || 'Our Collection', items: (Array.isArray(s.items) ? s.items : [ { name: 'Product 1', price: '$19', image: 'https://picsum.photos/seed/p1/300/200', description: 'Great product' }, { name: 'Product 2', price: '$29', image: 'https://picsum.photos/seed/p2/300/200', description: 'Amazing quality' }, { name: 'Product 3', price: '$39', image: 'https://picsum.photos/seed/p3/300/200', description: 'Best seller' }, ]).map(item => ({ name: item.name || item.title || 'Product', price: item.price || '$0', image: item.image || 'https://picsum.photos/seed/default/300/200', description: item.description || 'Product description' })), bgColor: s.bgColor || bg, textColor: s.textColor || text } };
      }
      if (t === 'categories-visual' || t.includes('categories')) {
        const cats = Array.isArray(s.categories) ? s.categories : [];
        return { id, type: 'collection', props: { title: s.title || 'Categories', items: cats.map(c => ({ title: c.name || c.title, price: '', image: c.imageUrl || c.image || 'https://picsum.photos/seed/cat/300/200' })), bgColor: s.bgColor || bg, textColor: s.textColor || text } };
      }
      if (t === 'instagram-feed' || t.includes('instagram')) {
        const count = s.numberOfPosts || 6;
        return { id, type: 'gallery', props: { title: s.title || 'Instagram', columns: 3, images: Array.from({ length: Math.min(12, Math.max(1, count)) }).map((_, i) => `https://picsum.photos/seed/insta-${s.username || 'feed'}-${i}/400/300`) } };
      }
      if (t === 'testimonials') {
        return { id, type: 'testimonials', props: { title: s.title || 'What customers say', items: (Array.isArray(s.items) ? s.items : [ { name: 'Alex', rating: 5, text: 'Amazing products!', avatar: 'https://picsum.photos/seed/alex/100/100' }, { name: 'Sam', rating: 5, text: 'Great support and fast delivery.', avatar: 'https://picsum.photos/seed/sam/100/100' }, ]).map(item => ({ name: item.name || item.author || 'Customer', rating: item.rating || 5, text: item.text || item.quote || 'Great experience!', avatar: item.avatar || `https://picsum.photos/seed/${item.name || 'user'}/100/100` })), bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0f172a' : '#f9fafb'), textColor: s.textColor || text } };
      }
      if (t === 'pricing') {
        return { id, type: 'pricing', props: { title: s.title || 'Pricing Plans', items: (Array.isArray(s.items) ? s.items : [ { name: 'Basic', price: '$9/mo', features: ['Feature A', 'Feature B'], buttonText: 'Get Started' }, { name: 'Pro', price: '$29/mo', features: ['Everything in Basic', 'Feature C'], buttonText: 'Choose Pro', featured: true }, ]).map(item => ({ name: item.name || 'Plan', price: item.price || '$0', features: Array.isArray(item.features) ? item.features : ['Feature 1', 'Feature 2'], buttonText: item.buttonText || 'Choose Plan', featured: item.featured || false })), bgColor: s.bgColor || bg, textColor: s.textColor || text } };
      }
      if (t === 'cta') {
        return { id, type: 'cta', props: { heading: s.title || s.heading || 'Ready to get started?', subheading: s.subtitle || s.subheading || 'Join us today', buttonText: s.buttonText || 'Get Started', buttonLink: s.buttonLink || '#', linkType: 'external', pageName: '', bgColor: s.bgColor || primary, textColor: s.textColor || '#ffffff' } };
      }
      if (t === 'gallery') {
        return { id, type: 'gallery', props: { title: s.title || 'Image Gallery', columns: 3, images: Array.isArray(s.images) ? s.images.map(img => typeof img === 'string' ? img : (img.url || img)) : ['https://picsum.photos/seed/1/400/300', 'https://picsum.photos/seed/2/400/300', 'https://picsum.photos/seed/3/400/300'], bgColor: s.bgColor || bg, textColor: s.textColor || text } };
      }
      if (t === 'newsletter') {
        return { id, type: 'newsletter', props: { title: s.title || 'Join our newsletter', description: s.subtitle || s.description || 'Get updates in your inbox.', placeholder: 'you@example.com', ctaText: s.buttonText || 'Subscribe', bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0b1220' : '#f3f4f6'), textColor: s.textColor || '#1f2937' } };
      }
      if (t === 'footer') {
        return { id, type: 'footer', props: { companyName: s.companyName || 'Company Name', tagline: s.tagline || 'Your company tagline', links: (Array.isArray(s.links) ? s.links : [ { text: 'Home', url: '#' }, { text: 'About', url: '#' }, { text: 'Contact', url: '#' }, ]).map(l => ({ text: l.text || 'Link', url: l.url || '#' })), bgColor: s.bgColor || (themeFromStore?.stylePreset === 'bold' ? '#0b1220' : '#1f2937'), textColor: s.textColor || '#f3f4f6' } };
      }
      return { id, type: t || 'custom', props: Object.keys(s || {}).reduce((acc, key) => { if (key !== 'id' && key !== 'type') acc[key] = s[key]; return acc; }, {}) };
    };

    let comps = [];
    const pageList = [];
    const byPage = {};

    if (incomingLayout && Array.isArray(incomingLayout.pages)) {
      incomingLayout.pages.forEach((pg, pidx) => {
        const name = pg.name || `Page ${pidx + 1}`;
        pageList.push({ id: `page-${pidx}`, name });
        byPage[name] = Array.isArray(pg.sections) ? pg.sections.map((s, idx) => normalizeSection(s, idx)) : [];
      });
    } else if (incomingLayout && Array.isArray(incomingLayout.sections)) {
      comps = incomingLayout.sections.map((s, idx) => normalizeSection(s, idx));
      pageList.push({ id: 'page-0', name: 'Home' });
      byPage['Home'] = comps;
    }

    if (pageList.length) {
      setPages(pageList);
      setComponentsByPage(byPage);
      const initialName = pageList[0].name;
      const initialComps = byPage[initialName] || [];
      setComponents(initialComps);
      setSelectedComponent(null);
      setHistory([JSON.parse(JSON.stringify(initialComps))]);
      setHistoryIndex(0);
      setCurrentPage(0);
    } else {
      setPages([{ id: 'page-0', name: 'Home' }]);
      setComponentsByPage({ Home: comps });
      setComponents(comps);
      setSelectedComponent(null);
      setHistory([JSON.parse(JSON.stringify(comps))]);
      setHistoryIndex(0);
      setCurrentPage(0);
    }
  };

  // Page management
  const selectPage = (index) => {
    setCurrentPage(index);
    const name = pages[index]?.name;
    const comps = componentsByPage[name] || [];
    setComponents(comps);
    setSelectedComponent(null);
    setHistory([JSON.parse(JSON.stringify(comps))]);
    setHistoryIndex(0);
  };

  const addPage = () => {
    const name = `Page ${pages.length + 1}`;
    const newPages = [...pages, { id: `page-${Date.now()}`, name }];
    const newMap = { ...componentsByPage, [name]: [] };
    setPages(newPages);
    setComponentsByPage(newMap);
    selectPage(newPages.length - 1);
  };

  const renamePage = (index, newName) => {
    const oldName = pages[index].name;
    const updatedPages = pages.map((p, i) => (i === index ? { ...p, name: newName } : p));
    const mapCopy = { ...componentsByPage };
    mapCopy[newName] = mapCopy[oldName] || [];
    delete mapCopy[oldName];
    setPages(updatedPages);
    setComponentsByPage(mapCopy);
    if (currentPage === index) {
      setComponents(mapCopy[newName] || []);
    }
  };

  const deletePage = (index) => {
    if (pages.length <= 1) return;
    const name = pages[index].name;
    const updatedPages = pages.filter((_, i) => i !== index);
    const mapCopy = { ...componentsByPage };
    delete mapCopy[name];
    setPages(updatedPages);
    setComponentsByPage(mapCopy);
    const newIdx = Math.max(0, index - 1);
    selectPage(newIdx);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over) return;

    // Dropping a library item anywhere on the canvas (including when empty)
    if (active.id.startsWith('library-')) {
      const componentType = active.id.replace('library-', '');
      const newComponent = createNewComponent(componentType);
      const newComponents = [...components, newComponent];
      setComponents(newComponents);
      // keep page map in sync
      const pageName = pages[currentPage]?.name;
      if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
      saveToHistory(newComponents);
      return;
    }

    // Reordering existing items within the page
    if (active.id !== over.id) {
      const oldIndex = components.findIndex((item) => item.id === active.id);
      const newIndex = components.findIndex((item) => item.id === over.id);
      const newComponents = arrayMove(components, oldIndex, newIndex);
      setComponents(newComponents);
      const pageName = pages[currentPage]?.name;
      if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
      saveToHistory(newComponents);
    }
  };

  const createNewComponent = (type) => {
    const id = `${type}-${Date.now()}`;
    const templates = {
      hero: {
        id,
        type: 'hero',
        props: {
          title: 'New Hero Section',
          subtitle: 'Add your subtitle here',
          buttonText: 'Click Me',
          buttonLink: '#',
          bgColor: '#3b82f6',
          textColor: '#ffffff',
          image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
        },
      },
      features: {
        id,
        type: 'features',
        props: {
          title: 'Features Section',
          items: [
            { icon: '⭐', title: 'Feature 1', description: 'Description here' },
            { icon: '🎯', title: 'Feature 2', description: 'Description here' },
            { icon: '🚀', title: 'Feature 3', description: 'Description here' },
          ],
          bgColor: '#f9fafb',
          textColor: '#111827',
        },
      },
      textblock: {
        id,
        type: 'textblock',
        props: {
          heading: 'Text Block Heading',
          content: 'Add your content here. This is a flexible text block that you can customize.',
          bgColor: '#ffffff',
          textColor: '#374151',
          alignment: 'left',
        },
      },
      footer: {
        id,
        type: 'footer',
        props: {
          companyName: 'Company Name',
          tagline: 'Your company tagline',
          links: [
            { text: 'Home', url: '#' },
            { text: 'About', url: '#' },
            { text: 'Contact', url: '#' },
          ],
          bgColor: '#1f2937',
          textColor: '#f3f4f6',
        },
      },
      navbar: {
        id,
        type: 'navbar',
        props: {
          logo: 'Logo',
          links: [
            { text: 'Home', url: '#' },
            { text: 'Products', url: '#' },
            { text: 'About', url: '#' },
            { text: 'Contact', url: '#' },
          ],
          bgColor: '#ffffff',
          textColor: '#1f2937',
        },
      },
      // New components
      faq: {
        id,
        type: 'faq',
        props: {
          title: 'Frequently Asked Questions',
          items: [
            { question: 'What is your return policy?', answer: '30 days return policy.' },
            { question: 'Do you ship internationally?', answer: 'Yes, worldwide.' },
          ],
        },
      },
      gallery: {
        id,
        type: 'gallery',
        props: {
          title: 'Image Gallery',
          columns: 3,
          images: [
            'https://picsum.photos/seed/1/400/300',
            'https://picsum.photos/seed/2/400/300',
            'https://picsum.photos/seed/3/400/300',
          ],
        },
      },
      newsletter: {
        id,
        type: 'newsletter',
        props: {
          title: 'Join our newsletter',
          description: 'Get updates in your inbox.',
          placeholder: 'you@example.com',
          ctaText: 'Subscribe',
        },
      },
      signup: {
        id,
        type: 'signup',
        props: {
          title: 'Create an account',
          description: 'Sign up to start shopping.',
        },
      },
      login: {
        id,
        type: 'login',
        props: {
          title: 'Welcome back',
        },
      },
      waitlist: {
        id,
        type: 'waitlist',
        props: {
          title: 'Join the waitlist',
          description: 'Be the first to know.',
          placeholder: 'you@example.com',
          ctaText: 'Notify me',
        },
      },
      contact: {
        id,
        type: 'contact',
        props: {
          title: 'Contact us',
          description: 'We usually reply within 24 hours.',
        },
      },
      collection: {
        id,
        type: 'collection',
        props: {
          title: 'Our Collection',
          items: [
            { title: 'Product 1', price: '$19', image: 'https://picsum.photos/seed/p1/300/200' },
            { title: 'Product 2', price: '$29', image: 'https://picsum.photos/seed/p2/300/200' },
            { title: 'Product 3', price: '$39', image: 'https://picsum.photos/seed/p3/300/200' },
          ],
        },
      },
      testimonials: {
        id,
        type: 'testimonials',
        props: {
          title: 'What customers say',
          items: [
            { quote: 'Amazing products!', author: 'Alex' },
            { quote: 'Great support and fast delivery.', author: 'Sam' },
          ],
        },
      },
      pricing: {
        id,
        type: 'pricing',
        props: {
          title: 'Pricing',
          plans: [
            { name: 'Basic', price: '$9', features: ['Feature A', 'Feature B'] },
            { name: 'Pro', price: '$29', features: ['Everything in Basic', 'Feature C'] },
          ],
        },
      },
      cta: {
        id,
        type: 'cta',
        props: {
          heading: 'Ready to get started?',
          subheading: 'Join us today',
          buttonText: 'Get started',
          linkType: 'external',
          buttonLink: '#',
          pageName: '',
        },
      },
      divider: {
        id,
        type: 'divider',
        props: { thickness: 2, color: '#e5e7eb' },
      },
      spacer: {
        id,
        type: 'spacer',
        props: { height: 32 },
      },
      image: {
        id,
        type: 'image',
        props: { src: 'https://picsum.photos/seed/solo/800/400', alt: 'Image' },
      },
      video: {
        id,
        type: 'video',
        props: { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
      },
      button: {
        id,
        type: 'button',
        props: { text: 'Click me', linkType: 'external', link: '#', pageName: '', variant: 'primary' },
      },
    };
    return templates[type] || templates.textblock;
  };

  const updateComponent = (id, newProps) => {
    const newComponents = components.map((comp) =>
      comp.id === id ? { ...comp, props: { ...comp.props, ...newProps } } : comp
    );
    setComponents(newComponents);
    // keep page map in sync
    const pageName = pages[currentPage]?.name;
    if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
    saveToHistory(newComponents);
    // If the updated component is currently selected, update the selectedComponent state
    if (selectedComponent && selectedComponent.id === id) {
      const updated = newComponents.find((c) => c.id === id);
      if (updated) setSelectedComponent(updated);
    }
  };

  const deleteComponent = (id) => {
    const newComponents = components.filter((comp) => comp.id !== id);
    setComponents(newComponents);
    const pageName = pages[currentPage]?.name;
    if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
    saveToHistory(newComponents);
    if (selectedComponent?.id === id) {
      setSelectedComponent(null);
    }
  };

  const duplicateComponent = (id) => {
    const component = components.find((comp) => comp.id === id);
    if (component) {
      const newComponent = {
        ...JSON.parse(JSON.stringify(component)),
        id: `${component.type}-${Date.now()}`,
      };
      const index = components.findIndex((comp) => comp.id === id);
      const newComponents = [
        ...components.slice(0, index + 1),
        newComponent,
        ...components.slice(index + 1),
      ];
      setComponents(newComponents);
      const pageName = pages[currentPage]?.name;
      if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
      saveToHistory(newComponents);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      const newComponents = history[nextIndex - 0];
      setComponents(newComponents);
      const pageName = pages[currentPage]?.name;
      if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const newComponents = history[nextIndex];
      setComponents(newComponents);
      const pageName = pages[currentPage]?.name;
      if (pageName) setComponentsByPage((prev) => ({ ...prev, [pageName]: newComponents }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build layout from pages
      let layout;
      if (pages.length > 1) {
        // Ensure current page edits are reflected in the map before saving
        const currentName = pages[currentPage]?.name;
        if (currentName) {
          // write-through latest components for current page
          // Note: using functional update to avoid race conditions
          setComponentsByPage((prev) => ({ ...prev, [currentName]: components }));
        }
        layout = {
          pages: pages.map((p) => ({ name: p.name, sections: (componentsByPage[p.name] || (p.name === currentName ? components : [])).map((c) => ({ type: c.type, ...c.props })) })),
        };
      } else {
        layout = { sections: components.map((c) => ({ type: c.type, ...c.props })) };
      }
      const storeId = localStorage.getItem('editorStoreId');
      if (!storeId) throw new Error('Missing storeId for save');

      const data = await storeAPI.saveEditorUpdate(storeId, { layout, theme: { id: themeId }, products: {} });
      console.log('Save response', data);
      setIsDirty(false);
      alert('Theme saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = () => {
    if (!isDirty || window.confirm('Are you sure you want to exit? Unsaved changes will be lost.')) {
      navigate('/dashboard');
    }
  };

  // Warn on browser/tab close when there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <TopBar
        storeName={location.state?.storeName || storeName}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onExit={handleExit}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isSaving={isSaving}
        storeId={localStorage.getItem('editorStoreId')}
        jsonLayout={{
          pages: pages.length > 1 
            ? pages.map((p) => ({ 
                name: p.name, 
                sections: (componentsByPage[p.name] || (p.name === pages[currentPage]?.name ? components : [])).map((c) => ({ type: c.type, ...c.props })) 
              }))
            : [{ name: 'Home', sections: components.map((c) => ({ type: c.type, ...c.props })) }]
        }}
      />

      <PageTabs
        pages={pages}
        currentIndex={currentPage}
        onSelect={selectPage}
        onAdd={addPage}
        onRename={renamePage}
        onDelete={deletePage}
      />

      <div className="flex-1 flex overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <ComponentLibrary />

          {htmlContent ? (
            // Render a sandboxed iframe for safer live preview. No scripts allowed.
            <div className="flex-1 bg-gray-50 overflow-hidden p-4">
              <div className="max-w-7xl mx-auto py-8">
                <div className="bg-white shadow-2xl rounded-lg overflow-hidden h-full">
                  <iframe
                    title="Theme Preview"
                    sandbox=""
                    srcDoc={htmlContent}
                    style={{ width: '100%, height: 80vh, border: none' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <SortableContext items={components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <Canvas
                components={components}
                selectedComponent={selectedComponent}
                onSelectComponent={setSelectedComponent}
                onUpdateComponent={updateComponent}
                onDeleteComponent={deleteComponent}
                onDuplicateComponent={duplicateComponent}
                onNavigatePage={(name) => {
                  if (!name) return;
                  const idx = pages.findIndex((p) => p.name === name);
                  if (idx >= 0) {
                    selectPage(idx);
                  } else {
                    // create the page if it doesn't exist
                    const newPages = [...pages, { id: `page-${Date.now()}`, name }];
                    const newMap = { ...componentsByPage, [name]: [] };
                    setPages(newPages);
                    setComponentsByPage(newMap);
                    setTimeout(() => selectPage(newPages.length - 1), 0);
                  }
                }}
                theme={theme}
              />
            </SortableContext>
          )}

          <PropertiesPanel
            selectedComponent={selectedComponent}
            onUpdateComponent={updateComponent}
            onDeleteComponent={deleteComponent}
            onDuplicateComponent={duplicateComponent}
            onClose={() => setSelectedComponent(null)}
            pages={pages}
            products={productList}
          />
        </DndContext>
      </div>
    </div>
  );
};

export default Editor;
