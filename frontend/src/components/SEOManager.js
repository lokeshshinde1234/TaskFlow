import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const defaultSeo = {
  title: 'Taskflow | Streamline Workflows & Project Management',
  description: 'Simplify your daily operations with Taskflow. Track tasks, automate repetitive workflows, and collaborate with your team in real time. Try it for free today!',
};

const seoByPath = {
  '/': defaultSeo,
  '/features': {
    title: 'Taskflow Features | Smart Automation & Task Tracking',
    description: 'Discover how Taskflow transforms team productivity. Explore visual Kanban boards, advanced time tracking, and seamless software integrations built to scale.',
  },
  '/pricing': {
    title: 'Taskflow Pricing | Affordable Plans for Growing Teams',
    description: 'Choose the perfect Taskflow plan for your business needs. Transparent pricing, no hidden fees, and a flexible free tier to get your team started instantly.',
  },
};

function ensureMeta(name, attribute = 'name') {
  let tag = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  return tag;
}

export default function SEOManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = seoByPath[location.pathname] || defaultSeo;
    document.title = seo.title;
    ensureMeta('description').setAttribute('content', seo.description);
    ensureMeta('og:title', 'property').setAttribute('content', seo.title);
    ensureMeta('og:description', 'property').setAttribute('content', seo.description);
    ensureMeta('twitter:title').setAttribute('content', seo.title);
    ensureMeta('twitter:description').setAttribute('content', seo.description);
  }, [location.pathname]);

  return null;
}
