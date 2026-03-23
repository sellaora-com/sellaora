import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../utils/api';

// Helpers
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#2563eb');
  if (!m) return [37, 99, 235];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};

const tint = (hex, factor = 0.85) => {
  const [r,g,b] = hexToRgb(hex);
  const nr = Math.round(255 - (255 - r) * factor);
  const ng = Math.round(255 - (255 - g) * factor);
  const nb = Math.round(255 - (255 - b) * factor);
  return `rgb(${nr}, ${ng}, ${nb})`;
};

const getThemeTokens = (theme = {}) => {
  const preset = (theme.stylePreset || '').toLowerCase();
  const primary = theme.primaryColor || '#2563eb';
  const secondary = theme.secondaryColor || '#1e40af';
  const accent = theme.accentColor || '#f59e0b';
  const radius = theme.borderRadius || 'lg';
  const shadow = (theme.shadow || 'soft').toLowerCase();
  
  const radiusClass = {
    'none': 'rounded-none',
    'sm': 'rounded-sm',
    'md': 'rounded-md',
    'lg': 'rounded-lg',
    'xl': 'rounded-xl',
    '2xl': 'rounded-2xl',
    'pill': 'rounded-full'
  }[radius] || 'rounded-lg';
  
  const shadowClass = {
    'none': '',
    'soft': 'shadow-sm',
    'medium': 'shadow-md',
    'elevated': 'shadow-lg',
    'dramatic': 'shadow-2xl'
  }[shadow] || 'shadow-sm';
  
  const pageBg = preset === 'gradient'
    ? `linear-gradient(135deg, ${tint(primary, 0.92)} 0%, ${tint(secondary, 0.85)} 100%)`
    : preset === 'bold' || preset === 'dark'
      ? '#0f172a'
      : '#ffffff';
  
  const cardBg = preset === 'bold' || preset === 'dark'
    ? 'bg-slate-800 text-slate-50 border-slate-700'
    : preset === 'glass'
      ? 'bg-white/60 backdrop-blur-lg text-neutral-900 border-white/30'
      : 'bg-white text-neutral-900 border-neutral-200';
  
  const textMuted = preset === 'bold' || preset === 'dark'
    ? 'text-slate-300'
    : 'text-neutral-600';
  
  return { 
    radiusClass, 
    shadowClass, 
    preset, 
    primary, 
    secondary, 
    accent, 
    pageBg, 
    cardBg, 
    textMuted 
  };
};

// Enhanced Navbar with more variants
const Navbar = ({ logo, links = [], bgColor, textColor, variant = 'solid', theme }) => {
  const { radiusClass, shadowClass, preset, primary } = getThemeTokens(theme);
  const isTransparent = variant === 'transparent' || preset === 'glass';
  
  return (
    <div 
      className={`mb-4 ${radiusClass} border ${shadowClass} ${
        isTransparent 
          ? 'bg-white/50 backdrop-blur-lg border-white/30' 
          : 'bg-white border-neutral-200'
      }`}
      style={!isTransparent && bgColor ? { backgroundColor: bgColor, color: textColor } : {}}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg">{logo || 'Logo'}</div>
        <div className="flex gap-6 text-sm font-medium">
          {links.map((l, i) => (
            <span key={i} className="opacity-80 hover:opacity-100 cursor-pointer transition-opacity">
              {l.text || l.name || `Link ${i+1}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Hero with multiple variants
const HeroSection = ({ title, subtitle, image, imageUrl, cta, variant = 'overlay', theme }) => {
  const { radiusClass, shadowClass, preset, primary } = getThemeTokens(theme);
  const img = imageUrl || image;
  
  // Split layout
  if (variant === 'split' || variant === 'hero-split') {
    return (
      <div className={`grid md:grid-cols-2 gap-6 mb-6 ${radiusClass} overflow-hidden ${shadowClass}`}>
        <div className={`p-8 flex flex-col justify-center ${preset === 'bold' ? 'bg-slate-800 text-white' : 'bg-white'}`}>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            {title || 'Hero Title'}
          </h1>
          {subtitle && <p className="text-lg opacity-90 mb-6">{subtitle}</p>}
          {cta && (
            <button 
              className="px-6 py-3 rounded-lg text-white font-semibold w-fit shadow-lg"
              style={{ backgroundColor: primary }}
            >
              {cta.text || 'Get Started'}
            </button>
          )}
        </div>
        <div className={`min-h-[300px] ${radiusClass} overflow-hidden`}>
          {img ? (
            <img src={img} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
          )}
        </div>
      </div>
    );
  }
  
  // Minimal centered
  if (variant === 'minimal' || variant === 'hero-minimal') {
    return (
      <div className={`text-center py-16 mb-6 ${radiusClass} ${preset === 'bold' ? 'bg-slate-800 text-white' : 'bg-white'} ${shadowClass}`}>
        <h1 className="text-6xl font-extrabold tracking-tight mb-4">
          {title || 'Hero Title'}
        </h1>
        {subtitle && <p className="text-xl opacity-80 max-w-2xl mx-auto mb-6">{subtitle}</p>}
        {cta && (
          <button 
            className="px-8 py-4 rounded-lg text-white font-semibold shadow-lg"
            style={{ backgroundColor: primary }}
          >
            {cta.text || 'Get Started'}
          </button>
        )}
      </div>
    );
  }
  
  // Default overlay
  return (
    <div className={`relative h-96 ${radiusClass} overflow-hidden mb-6 ${shadowClass}`}>
      {img ? (
        <img src={img} alt={title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-neutral-300 to-neutral-400" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-8">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 drop-shadow-lg">
          {title || 'Hero Title'}
        </h1>
        {subtitle && <p className="text-lg md:text-xl mb-6 max-w-2xl drop-shadow">{subtitle}</p>}
        {cta && (
          <div className="flex gap-3">
            <button 
              className="px-6 py-3 rounded-lg text-white font-semibold shadow-lg"
              style={{ backgroundColor: primary }}
            >
              {cta.text || 'Get Started'}
            </button>
            {cta.secondaryText && (
              <button className="px-6 py-3 rounded-lg bg-white/20 backdrop-blur text-white font-semibold">
                {cta.secondaryText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Product Grid Component
const ProductGrid = ({ title, products = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  const productList = products.length > 0 ? products : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {productList.map((product, i) => (
          <div key={i} className={`bg-white ${radiusClass} border border-neutral-200 p-4 hover:shadow-lg transition-shadow`}>
            {(product.image || product.imageUrl) && (
              <div className={`w-full h-40 mb-3 ${radiusClass} overflow-hidden`}>
                <img 
                  src={product.image || product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h3 className="font-semibold text-sm mb-1">{product.name || 'Product'}</h3>
            {product.description && <p className="text-xs text-neutral-600 mb-2">{product.description}</p>}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold" style={{ color: primary }}>
                {product.price || '$0.00'}
              </span>
              <button className="text-xs px-3 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Features Grid
const FeaturesGrid = ({ title, features = [], items = [], variant = 'cards', theme }) => {
  const { radiusClass, shadowClass, cardBg, textMuted, primary } = getThemeTokens(theme);
  const featureList = features.length > 0 ? features : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {featureList.map((feature, i) => (
          <div key={i} className={`text-center p-6 bg-white ${radiusClass} border border-neutral-200`}>
            <div className="text-4xl mb-3">{feature.icon || '⭐'}</div>
            <h3 className="font-semibold text-lg mb-2">{feature.title || feature.name || 'Feature'}</h3>
            <p className={`text-sm ${textMuted}`}>{feature.description || ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Testimonials Section
const TestimonialsSection = ({ title, testimonials = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, textMuted } = getThemeTokens(theme);
  const testimonialList = testimonials.length > 0 ? testimonials : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonialList.map((testimonial, i) => (
          <div key={i} className={`bg-white p-5 ${radiusClass} border border-neutral-200`}>
            <div className="text-yellow-400 mb-3">{'⭐'.repeat(testimonial.rating || 5)}</div>
            <p className="text-sm mb-4 italic">"{testimonial.text || testimonial.content || 'Great product!'}"</p>
            <div className="flex items-center gap-3">
              {testimonial.avatar && (
                <img src={testimonial.avatar} alt={testimonial.name} className="w-10 h-10 rounded-full" />
              )}
              <div>
                <div className="font-semibold text-sm">{testimonial.name || 'Customer'}</div>
                {testimonial.role && <div className={`text-xs ${textMuted}`}>{testimonial.role}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Pricing Section
const PricingSection = ({ title, plans = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  const planList = plans.length > 0 ? plans : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planList.map((plan, i) => (
          <div 
            key={i} 
            className={`p-6 ${radiusClass} border-2 ${
              plan.featured 
                ? 'border-blue-500 bg-blue-50 scale-105' 
                : 'border-neutral-200 bg-white'
            }`}
          >
            <div className="text-center">
              <h3 className="font-bold text-xl mb-2">{plan.name || 'Plan'}</h3>
              <div className="text-4xl font-extrabold mb-4" style={{ color: primary }}>
                {plan.price || '$0'}
              </div>
              {plan.description && <p className="text-sm text-neutral-600 mb-4">{plan.description}</p>}
              {plan.features && (
                <ul className="text-left text-sm space-y-2 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button 
                className={`w-full py-3 ${radiusClass} font-semibold ${
                  plan.featured 
                    ? 'text-white shadow-lg' 
                    : 'bg-neutral-100 text-neutral-800'
                }`}
                style={plan.featured ? { backgroundColor: primary } : {}}
              >
                {plan.buttonText || 'Choose Plan'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Gallery Section
const GallerySection = ({ title, images = [], variant = 'grid', theme }) => {
  const { radiusClass, shadowClass, cardBg } = getThemeTokens(theme);
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className={`grid ${variant === 'masonry' ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
        {images.map((img, i) => {
          const src = typeof img === 'string' ? img : (img.url || img.src);
          const caption = typeof img === 'object' ? img.caption : null;
          return (
            <div key={i} className={`${radiusClass} overflow-hidden`}>
              <img src={src} alt={caption || `Gallery ${i}`} className="w-full h-full object-cover" />
              {caption && <p className="text-xs text-neutral-600 mt-1">{caption}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Stats Section
const StatsSection = ({ stats = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  const statList = stats.length > 0 ? stats : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {statList.map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-4xl font-extrabold mb-1" style={{ color: primary }}>
              {stat.value || '0'}
            </div>
            <div className="text-sm text-neutral-600">{stat.label || 'Stat'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Process/Steps Section
const ProcessSection = ({ title, steps = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  const stepList = steps.length > 0 ? steps : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stepList.map((step, i) => (
          <div key={i} className="flex gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ backgroundColor: primary }}
            >
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold mb-1">{step.title || `Step ${i+1}`}</h3>
              <p className="text-sm text-neutral-600">{step.description || ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// CTA Section
const CTASection = ({ title, subtitle, cta, buttonText, bgColor, textColor, theme }) => {
  const { radiusClass, shadowClass, primary } = getThemeTokens(theme);
  
  return (
    <div 
      className={`${radiusClass} p-8 mb-6 text-center ${shadowClass}`}
      style={{ backgroundColor: bgColor || primary, color: textColor || '#ffffff' }}
    >
      <h2 className="text-3xl font-bold mb-3">{title || 'Ready to Get Started?'}</h2>
      {subtitle && <p className="text-lg opacity-90 mb-6">{subtitle}</p>}
      <button className="px-8 py-4 rounded-lg bg-white text-neutral-900 font-semibold hover:bg-neutral-100 transition-colors">
        {(cta && cta.text) || buttonText || 'Get Started'}
      </button>
    </div>
  );
};

// About/Text Section
const AboutSection = ({ title, content, text, image, imageUrl, theme }) => {
  const { radiusClass, shadowClass, cardBg } = getThemeTokens(theme);
  const img = imageUrl || image;
  
  if (img) {
    return (
      <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass} grid md:grid-cols-2 gap-6`}>
        <div>
          {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
          <div className="prose prose-sm">{content || text || ''}</div>
        </div>
        <div className={`${radiusClass} overflow-hidden`}>
          <img src={img} alt={title} className="w-full h-full object-cover" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="prose prose-sm max-w-none whitespace-pre-wrap">{content || text || ''}</div>
    </div>
  );
};

// FAQ Section
const FAQSection = ({ title, faqs = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg } = getThemeTokens(theme);
  const faqList = faqs.length > 0 ? faqs : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="space-y-4">
        {faqList.map((faq, i) => (
          <div key={i} className="bg-white p-5 rounded-lg border border-neutral-200">
            <h3 className="font-semibold mb-2">{faq.q || faq.question || 'Question?'}</h3>
            <p className="text-sm text-neutral-600">{faq.a || faq.answer || 'Answer here.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Newsletter Section
const NewsletterSection = ({ title, subtitle, buttonText, theme }) => {
  const { radiusClass, shadowClass, primary } = getThemeTokens(theme);
  
  return (
    <div className={`bg-neutral-50 ${radiusClass} border border-neutral-200 p-8 mb-6 text-center ${shadowClass}`}>
      <h2 className="text-2xl font-bold mb-2">{title || 'Stay Updated'}</h2>
      {subtitle && <p className="text-neutral-600 mb-6">{subtitle}</p>}
      <div className="flex gap-2 max-w-md mx-auto">
        <input 
          type="email" 
          placeholder="Enter your email" 
          className="flex-1 px-4 py-3 rounded-lg border border-neutral-300"
        />
        <button 
          className="px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: primary }}
        >
          {buttonText || 'Subscribe'}
        </button>
      </div>
    </div>
  );
};

// Footer
const FooterSection = ({ companyName, tagline, links = [], theme }) => {
  const { radiusClass, shadowClass } = getThemeTokens(theme);
  
  return (
    <div className={`bg-neutral-900 text-neutral-100 ${radiusClass} border border-neutral-800 p-8 mb-6 ${shadowClass}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h3 className="font-bold text-xl mb-2">{companyName || 'Company'}</h3>
          {tagline && <p className="text-sm text-neutral-400">{tagline}</p>}
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-6 md:justify-end">
          {links.map((link, i) => (
            <a key={i} href={link.href || '#'} className="text-sm hover:text-white transition-colors">
              {link.text || link.name || 'Link'}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

// Categories Component
const CategoriesSection = ({ title, categories = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  const categoryList = categories.length > 0 ? categories : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {categoryList.map((cat, i) => (
          <div key={i} className={`relative ${radiusClass} overflow-hidden group cursor-pointer`}>
            <div className="aspect-square">
              {(cat.imageUrl || cat.image) ? (
                <img 
                  src={cat.imageUrl || cat.image} 
                  alt={cat.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
              <div className="text-white">
                <h3 className="font-bold text-lg mb-1">{cat.name || 'Category'}</h3>
                {cat.description && <p className="text-sm opacity-90">{cat.description}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Instagram Feed Component
const InstagramFeed = ({ title, handle, postCount = 6, theme }) => {
  const { radiusClass, shadowClass, cardBg } = getThemeTokens(theme);
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-2">{title || 'Follow Us on Instagram'}</h2>
        {handle && <a href={`https://instagram.com/${handle}`} className="text-sm text-blue-500">@{handle}</a>}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: postCount }).map((_, i) => (
          <div key={i} className={`aspect-square ${radiusClass} overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100`}>
            <div className="w-full h-full flex items-center justify-center text-purple-300">
              📸
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Team Section Component
const TeamSection = ({ title, team = [], items = [], theme }) => {
  const { radiusClass, shadowClass, cardBg, textMuted } = getThemeTokens(theme);
  const teamList = team.length > 0 ? team : items;
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {teamList.map((member, i) => (
          <div key={i} className="text-center">
            <div className={`w-32 h-32 mx-auto mb-3 ${radiusClass} overflow-hidden`}>
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-4xl">
                  👤
                </div>
              )}
            </div>
            <h3 className="font-semibold">{member.name || 'Team Member'}</h3>
            {member.role && <p className={`text-sm ${textMuted}`}>{member.role}</p>}
            {member.bio && <p className="text-xs mt-2 text-neutral-600">{member.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

// Location/Contact Component
const LocationSection = ({ title, address, phone, email, hours, theme }) => {
  const { radiusClass, shadowClass, cardBg } = getThemeTokens(theme);
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {address && (
            <div className="flex items-start gap-3">
              <span className="text-xl">📍</span>
              <div>
                <div className="font-semibold">Address</div>
                <div className="text-sm text-neutral-600">{address}</div>
              </div>
            </div>
          )}
          {phone && (
            <div className="flex items-start gap-3">
              <span className="text-xl">📞</span>
              <div>
                <div className="font-semibold">Phone</div>
                <div className="text-sm text-neutral-600">{phone}</div>
              </div>
            </div>
          )}
          {email && (
            <div className="flex items-start gap-3">
              <span className="text-xl">✉️</span>
              <div>
                <div className="font-semibold">Email</div>
                <div className="text-sm text-neutral-600">{email}</div>
              </div>
            </div>
          )}
          {hours && (
            <div className="flex items-start gap-3">
              <span className="text-xl">🕐</span>
              <div>
                <div className="font-semibold">Hours</div>
                <div className="text-sm text-neutral-600 whitespace-pre-line">{hours}</div>
              </div>
            </div>
          )}
        </div>
        <div className={`${radiusClass} overflow-hidden bg-neutral-100 h-64 flex items-center justify-center`}>
          <span className="text-neutral-400">📍 Map</span>
        </div>
      </div>
    </div>
  );
};

// Contact Form Component
const ContactForm = ({ title, subtitle, theme }) => {
  const { radiusClass, shadowClass, cardBg, primary } = getThemeTokens(theme);
  
  return (
    <div className={`${cardBg} ${radiusClass} border p-6 mb-6 ${shadowClass}`}>
      {title && <h2 className="text-2xl font-bold mb-2">{title}</h2>}
      {subtitle && <p className="text-neutral-600 mb-6">{subtitle}</p>}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="text" 
            placeholder="Name" 
            className="px-4 py-3 border border-neutral-300 rounded-lg"
          />
          <input 
            type="email" 
            placeholder="Email" 
            className="px-4 py-3 border border-neutral-300 rounded-lg"
          />
        </div>
        <input 
          type="text" 
          placeholder="Subject" 
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg"
        />
        <textarea 
          placeholder="Message" 
          rows={5}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg"
        />
        <button 
          className="w-full py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: primary }}
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

// Smart Section Renderer
const renderSection = (section, idx, theme) => {
  if (!section) return null;
  
  const type = String(section.type || '').toLowerCase().replace(/[-_]/g, '');
  
  // Map section types to components - EXPANDED VERSION
  const componentMap = {
    // Hero variants (all possible names)
    'hero': HeroSection,
    'herominimal': HeroSection,
    'herosplit': HeroSection,
    'herooverlay': HeroSection,
    'herogradient': HeroSection,
    'herovideo': HeroSection,
    'heroproduct': HeroSection,
    'heroheadline': HeroSection,
    'heroillustration': HeroSection,
    
    // Features (all variations)
    'features': FeaturesGrid,
    'featuresgrid': FeaturesGrid,
    'featuresalternating': FeaturesGrid,
    'featurestabs': FeaturesGrid,
    'benefitslist': FeaturesGrid,
    
    // Products/Services (all variations)
    'products': ProductGrid,
    'productgrid': ProductGrid,
    'productfeatured': ProductGrid,
    'services': ProductGrid,
    'servicescards': ProductGrid,
    'collection': ProductGrid,
    'portfolio': ProductGrid,
    'portfolioshowcase': ProductGrid,
    'casestudy': ProductGrid,
    'casestudies': ProductGrid,
    
    // Categories
    'categories': CategoriesSection,
    'categoriesvisual': CategoriesSection,
    'categorieslist': CategoriesSection,
    
    // Social proof (all variations)
    'testimonials': TestimonialsSection,
    'testimonialscards': TestimonialsSection,
    'testimonialsslider': TestimonialsSection,
    'reviews': TestimonialsSection,
    'reviewsaggregate': TestimonialsSection,
    'clientlogos': TestimonialsSection,
    'successstories': TestimonialsSection,
    'partners': TestimonialsSection,
    
    // Pricing
    'pricing': PricingSection,
    'pricingcards': PricingSection,
    'pricingtiers': PricingSection,
    'pricingtable': PricingSection,
    
    // Visual (all variations)
    'gallery': GallerySection,
    'gallerymasonry': GallerySection,
    'gallerygrid': GallerySection,
    'gallerycarousel': GallerySection,
    'videoembed': GallerySection,
    'video': GallerySection,
    
    // Stats
    'stats': StatsSection,
    'statistics': StatsSection,
    'statsshowcase': StatsSection,
    
    // Process (all variations)
    'process': ProcessSection,
    'processsteps': ProcessSection,
    'steps': ProcessSection,
    'howitworks': ProcessSection,
    'timeline': ProcessSection,
    
    // Content
    'about': AboutSection,
    'aboutstory': AboutSection,
    'textblock': AboutSection,
    'content': AboutSection,
    
    // Team
    'team': TeamSection,
    'teamgrid': TeamSection,
    'teamspotlight': TeamSection,
    
    // FAQ
    'faq': FAQSection,
    'faqs': FAQSection,
    'faqaccordion': FAQSection,
    
    // Conversion (all variations)
    'cta': CTASection,
    'ctabanner': CTASection,
    'ctainline': CTASection,
    'calltoaction': CTASection,
    'newsletter': NewsletterSection,
    'formnewsletter': NewsletterSection,
    
    // Contact
    'contact': ContactForm,
    'contactform': ContactForm,
    'formcontact': ContactForm,
    'formbooking': ContactForm,
    'location': LocationSection,
    'locations': LocationSection,
    'locationmap': LocationSection,
    'hoursinfo': LocationSection,
    
    // Social
    'instagramfeed': InstagramFeed,
    'socialfeed': InstagramFeed,
    
    // Navigation
    'navbar': Navbar,
    'navigation': Navbar,
    'footer': FooterSection
  };
  
  const Component = componentMap[type];
  
  if (Component) {
    return <Component key={idx} {...section} theme={theme} />;
  }
  
  // Fallback for unknown types
  console.warn(`Unknown section type: ${section.type}`);
  return (
    <div key={idx} className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
      <div className="font-semibold text-yellow-800 mb-2">
        Unknown Section: {section.type}
      </div>
      <pre className="text-xs text-yellow-700 overflow-auto max-h-40">
        {JSON.stringify(section, null, 2)}
      </pre>
    </div>
  );
};

const SimpleFallback = ({ storeId, theme, layout }) => {
  const sections = layout?.sections || layout?.pages?.[0]?.sections || [];
  const storeName = theme?.siteName || theme?.name || layout?.siteName || 'Your Store';
  
  // Debug: Log the actual data being received
  console.log('SimpleFallback received:', { 
    storeName, 
    sectionsCount: sections.length, 
    sections: sections.map(s => ({ type: s.type, title: s.title, hasContent: !!s.content })),
    theme,
    layout 
  });
  
  const renderSection = (section, index) => {
    const sectionType = section.type?.toLowerCase();
    
    switch (sectionType) {
      case 'navbar':
        return (
          <nav key={index} className="bg-white shadow-sm border-b sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {storeName[0]?.toUpperCase()}
                  </div>
                  <span className="text-xl font-bold text-gray-900">{storeName}</span>
                </div>
                <div className="hidden md:flex space-x-8">
                  <a href="#" className="text-gray-700 hover:text-blue-600 font-medium">Home</a>
                  <a href="#" className="text-gray-700 hover:text-blue-600 font-medium">Products</a>
                  <a href="#" className="text-gray-700 hover:text-blue-600 font-medium">About</a>
                  <a href="#" className="text-gray-700 hover:text-blue-600 font-medium">Contact</a>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="text-gray-600 hover:text-blue-600">🔍</button>
                  <button className="text-gray-600 hover:text-blue-600">👤</button>
                  <button className="relative text-gray-600 hover:text-blue-600">
                    🛒
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">2</span>
                  </button>
                </div>
              </div>
            </div>
          </nav>
        );
        
      case 'hero':
        return (
          <section key={index} className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {section.title || section.heading || 'Welcome to ' + storeName}
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                {section.subtitle || section.subheading || 'Discover amazing products and exceptional service'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-lg transform hover:scale-105 transition-all">
                  Shop Now
                </button>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-all">
                  Learn More
                </button>
              </div>
            </div>
          </section>
        );
        
      case 'products':
      case 'collection':
        // Use actual products from section data or generate based on prompt context
        const products = section.items || section.products || [
          { name: 'Premium Product 1', price: '$99', description: 'High-quality product with amazing features' },
          { name: 'Popular Item 2', price: '$79', description: 'Customer favorite with excellent reviews' },
          { name: 'New Arrival 3', price: '$119', description: 'Latest addition to our collection' }
        ];
        
        return (
          <section key={index} className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.title || section.heading || 'Featured Products'}
                </h2>
                <p className="text-lg text-gray-600">
                  {section.subtitle || section.description || 'Discover our carefully curated collection'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map((product, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="bg-gray-100 rounded-xl aspect-square mb-4 flex items-center justify-center group-hover:shadow-xl transition-shadow overflow-hidden">
                      {product.image || product.imageUrl ? (
                        <img 
                          src={product.image || product.imageUrl} 
                          alt={product.name || product.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">📦</span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {product.name || product.title || `Product ${i + 1}`}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {product.description || 'High-quality product with amazing features'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-blue-600">
                        {product.price || '$99'}
                      </span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
        
      case 'testimonials':
        // Use actual testimonials from section data
        const testimonials = section.items || section.testimonials || [
          { name: 'Sarah J.', text: 'Amazing products and exceptional service! Highly recommend to everyone.', rating: 5 },
          { name: 'Mike C.', text: 'Great quality and fast delivery. Will definitely shop again!', rating: 5 },
          { name: 'Emma D.', text: 'Outstanding customer support and beautiful products.', rating: 5 }
        ];
        
        return (
          <section key={index} className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.title || section.heading || 'What Our Customers Say'}
                </h2>
                {section.subtitle && (
                  <p className="text-lg text-gray-600">{section.subtitle}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {testimonials.map((testimonial, i) => {
                  const name = testimonial.name || testimonial.author || `Customer ${i + 1}`;
                  const rating = testimonial.rating || 5;
                  const text = testimonial.text || testimonial.quote || testimonial.content || 'Great experience!';
                  
                  return (
                    <div key={i} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex mb-4">
                        {[...Array(5)].map((_, star) => (
                          <span key={star} className={`text-lg ${star < rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                        ))}
                      </div>
                      <p className="text-gray-600 mb-4 italic">
                        "{text}"
                      </p>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                          {name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{name}</div>
                          <div className="text-sm text-gray-500">{testimonial.role || 'Verified Customer'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
        
      case 'footer':
        return (
          <footer key={index} className="bg-gray-900 text-white py-12">
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {storeName[0]?.toUpperCase()}
                    </div>
                    <span className="text-xl font-bold">{storeName}</span>
                  </div>
                  <p className="text-gray-400 mb-4">Your trusted partner for quality products and exceptional service.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">Quick Links</h3>
                  <ul className="space-y-2 text-gray-400">
                    <li><a href="#" className="hover:text-white">Home</a></li>
                    <li><a href="#" className="hover:text-white">Products</a></li>
                    <li><a href="#" className="hover:text-white">About</a></li>
                    <li><a href="#" className="hover:text-white">Contact</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">Contact</h3>
                  <ul className="space-y-2 text-gray-400">
                    <li>📧 hello@store.com</li>
                    <li>📞 (555) 123-4567</li>
                    <li>📍 123 Business St</li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; 2024 {storeName}. All rights reserved.</p>
              </div>
            </div>
          </footer>
        );
        
      case 'features':
        const features = section.items || section.features || [
          { title: 'Fast Delivery', description: 'Quick shipping worldwide', icon: '🚚' },
          { title: 'Secure Payment', description: 'Safe and encrypted transactions', icon: '🔒' },
          { title: '24/7 Support', description: 'Always here to help you', icon: '💬' }
        ];
        
        return (
          <section key={index} className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.title || section.heading || 'Why Choose Us'}
                </h2>
                {section.subtitle && (
                  <p className="text-lg text-gray-600">{section.subtitle}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {features.map((feature, i) => (
                  <div key={i} className="text-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-4xl mb-4">{feature.icon || '⭐'}</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {feature.title || feature.name || `Feature ${i + 1}`}
                    </h3>
                    <p className="text-gray-600">{feature.description || 'Feature description'}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
        
      case 'about':
      case 'story':
        return (
          <section key={index} className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.title || section.heading || 'About Us'}
                </h2>
              </div>
              <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed">
                <p>{section.content || section.text || section.description || 'Tell your story here. Share what makes your business unique and why customers should choose you.'}</p>
              </div>
            </div>
          </section>
        );
        
      case 'contact':
        return (
          <section key={index} className="py-16 bg-gray-50">
            <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.title || section.heading || 'Get In Touch'}
                </h2>
                {section.subtitle && (
                  <p className="text-lg text-gray-600">{section.subtitle}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📧</span>
                      <span>{section.email || 'hello@yourstore.com'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📞</span>
                      <span>{section.phone || '(555) 123-4567'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📍</span>
                      <span>{section.address || '123 Business Street, City, State'}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Send Message</h3>
                  <form className="space-y-4">
                    <input type="text" placeholder="Your Name" className="w-full p-3 border border-gray-300 rounded-lg" />
                    <input type="email" placeholder="Your Email" className="w-full p-3 border border-gray-300 rounded-lg" />
                    <textarea placeholder="Your Message" rows="4" className="w-full p-3 border border-gray-300 rounded-lg"></textarea>
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors">
                      Send Message
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        );
        
      case 'newsletter':
      case 'signup':
        return (
          <section key={index} className="py-16 bg-blue-600">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {section.title || section.heading || 'Stay Updated'}
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                {section.subtitle || section.description || 'Get the latest news and exclusive offers'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-1 px-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-blue-300"
                />
                <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </section>
        );
      
      default:
        return (
          <div key={index} className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="bg-gray-100 rounded-lg p-8">
                <h3 className="text-xl font-semibold mb-4">{section.type || 'Custom Section'}</h3>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{section.title || section.heading || 'Section Title'}</h2>
                {section.subtitle && <p className="text-lg text-gray-600 mb-4">{section.subtitle}</p>}
                {section.content && <p className="text-gray-600">{section.content}</p>}
                {section.description && <p className="text-gray-600">{section.description}</p>}
              </div>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {sections.length > 0 ? (
        <div className="space-y-0">
          {sections.map((section, index) => renderSection(section, index))}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Content Yet</h2>
            <p className="text-gray-600">Submit a prompt to generate your website content</p>
          </div>
        </div>
      )}
    </div>
  );
};

const StorePreview = ({ storeId, theme = {}, layout = {} }) => {
  const [previewMode, setPreviewMode] = useState('legacy'); // Use legacy preview to avoid white screen
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  
  // Debug logging and error handling
  useEffect(() => {
    console.log('StorePreview mounted:', { storeId, hasTheme: !!theme, hasLayout: !!layout, previewMode });

    const handleWindowError = (e) => {
      console.error('Window error in StorePreview:', e.error);
    };
    const handleUnhandledRejection = (e) => {
      console.error('Unhandled promise rejection in StorePreview:', e.reason);
    };

    // Log any errors that might be causing white screen
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [storeId, theme, layout, previewMode]);
  
  // Start loading when HTML preview mode is enabled
  useEffect(() => {
    if (previewMode === 'html' && storeId) {
      setIsLoading(true);
    }
  }, [previewMode, storeId]);
  
  // Generate preview URL for iframe
  const getPreviewUrl = () => {
    if (!storeId) return null;
    return `${getApiBaseUrl()}/store/${storeId}/preview?token=${token}`;
  };
  
  // Handle iframe load events
  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };
  
  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load preview');
  };
  
  // Legacy preview component
  const LegacyPreview = () => {
    const { pageBg, primary, preset } = getThemeTokens(theme);
    const fontFamily = theme?.fonts || 'Inter, system-ui, sans-serif';
    
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    
    const pages = Array.isArray(layout?.pages) && layout.pages.length > 0
      ? layout.pages
      : layout?.sections
        ? [{ name: 'Home', path: '/', sections: layout.sections }]
        : [{ name: 'Home', path: '/', sections: [] }];
    
    const currentPage = pages[currentPageIndex] || pages[0];
    const currentSections = currentPage?.sections || [];
    
    return (
      <div 
        className="w-full min-h-screen" 
        style={{ 
          fontFamily, 
          background: pageBg,
          backgroundColor: pageBg.includes('gradient') ? undefined : pageBg
        }}
      >
        <div className="p-6">
          {/* Theme Info Bar */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            {theme.logoUrl && (
              <img src={theme.logoUrl} alt="logo" className="w-12 h-12 rounded-lg shadow" />
            )}
            <div 
              className="px-4 py-2 rounded-lg text-white font-semibold shadow-md"
              style={{ backgroundColor: primary }}
            >
              Primary Color
            </div>
            {preset && (
              <div className="px-4 py-2 rounded-lg bg-neutral-800 text-white text-sm font-medium">
                Style: {preset}
              </div>
            )}
            {theme.layoutPattern && (
              <div className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium">
                Layout: {theme.layoutPattern}
              </div>
            )}
          </div>
          
          {/* Page Navigation */}
          {pages.length > 1 && (
            <div className="mb-6 bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 mb-3">PAGES</div>
              <div className="flex gap-2 flex-wrap">
                {pages.map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPageIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPageIndex === idx
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {page.name || `Page ${idx + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Current Page Info */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200">
              📄 {currentPage.name || 'Untitled Page'}
              <span className="opacity-70">({currentPage.path || '/'})</span>
            </div>
            {currentPage.description && (
              <p className="text-sm text-neutral-600 mt-2">{currentPage.description}</p>
            )}
          </div>
          
          {/* Banner */}
          {theme.bannerUrl && (
            <div className="mb-6 rounded-xl overflow-hidden shadow-lg">
              <img src={theme.bannerUrl} alt="banner" className="w-full h-48 object-cover" />
            </div>
          )}
          
          {/* Render Sections */}
          {currentSections.length > 0 ? (
            currentSections.map((section, idx) => renderSection(section, idx, theme))
          ) : (
            <div className="bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">🎨</div>
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">No Sections Yet</h3>
              <p className="text-neutral-600">Use the AI builder to generate your website content</p>
            </div>
          )}
          
          {/* Section Count Footer */}
          <div className="mt-8 pt-6 border-t border-neutral-200 text-center text-sm text-neutral-500">
            <div className="flex items-center justify-center gap-6">
              <span>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
              <span>•</span>
              <span>{currentSections.length} sections on this page</span>
              <span>•</span>
              <span className="font-mono">{preset || 'default'} theme</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // If no storeId, always use legacy preview
  if (!storeId) {
    return <LegacyPreview />;
  }
  
  // Main preview render
  if (previewMode === 'html' && storeId) {
    const previewUrl = getPreviewUrl();
    
    if (!previewUrl) {
      console.warn('No preview URL generated, falling back to legacy');
      return <LegacyPreview />;
    }
    
    return (
      <div className="w-full h-full flex flex-col">
        {/* Preview Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Store Preview</h3>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                Loading...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode('html')}
              className={`px-3 py-1 text-sm rounded ${
                previewMode === 'html'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              HTML Preview
            </button>
            <button
              onClick={() => setPreviewMode('legacy')}
              className={`px-3 py-1 text-sm rounded ${
                previewMode === 'legacy'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Legacy Preview
            </button>
          </div>
        </div>
        
        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Preview Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <button 
                    onClick={() => setPreviewMode('legacy')}
                    className="mt-2 text-red-800 underline hover:text-red-900"
                  >
                    Switch to Legacy Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* HTML Preview */}
        {previewUrl && !error && (
          <div className="flex-1 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading preview...</p>
                </div>
              </div>
            )}
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Store Preview"
            />
          </div>
        )}
      </div>
    );
  }
  
  // Use simple fallback to prevent white screen crashes
  try {
    console.log('Rendering StorePreview with data:', { 
      storeId,
      hasTheme: !!theme, 
      hasLayout: !!layout, 
      sectionsCount: layout?.sections?.length || 0,
      pagesCount: layout?.pages?.length || 0,
      previewMode
    });
    
    // For now, always use the simple fallback to prevent crashes
    return <SimpleFallback storeId={storeId} theme={theme} layout={layout} />;
    
  } catch (error) {
    console.error('StorePreview critical error:', error);
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 text-lg font-semibold mb-2">Critical Preview Error</div>
        <div className="text-sm text-red-500 mb-4">Error: {error.message || 'Unknown error'}</div>
        <div className="text-xs text-gray-600 mb-4">
          StoreId: {storeId || 'None'} | Theme: {!!theme ? 'Yes' : 'No'} | Layout: {!!layout ? 'Yes' : 'No'}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reload Page
        </button>
      </div>
    );
  }
};

export default StorePreview;
