document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initScrollAnimations();
  initMobileMenu();
  initScrollIndicator();
});

function initNavigation() {
  const nav = document.querySelector('nav');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav ul li a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

  document.querySelectorAll('.feature-card, .quickstart-step, .changelog-item, .guide-section').forEach(el => {
    el.classList.add('animate-on-scroll');
    observer.observe(el);
  });
}

function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navUl = document.querySelector('nav ul');

  if (menuBtn && navUl) {
    menuBtn.addEventListener('click', () => {
      navUl.classList.toggle('active');
      menuBtn.textContent = navUl.classList.contains('active') ? '✕' : '☰';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('nav')) {
        navUl.classList.remove('active');
        menuBtn.textContent = '☰';
      }
    });
  }
}

function initScrollIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, #00D9FF, #FFD700);
    z-index: 10001;
    transition: width 0.1s;
  `;
  document.body.appendChild(indicator);

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    indicator.style.width = scrollPercent + '%';
  });
}

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function loadChangelog() {
  const container = document.getElementById('changelog-container');
  if (!container) return;

  try {
    const response = await fetch('/api/changelog');
    const data = await response.json();
    
    if (data.entries && data.entries.length > 0) {
      container.innerHTML = data.entries.map(entry => `
        <div class="changelog-item">
          <div class="changelog-header">
            <span class="changelog-version">${entry.version}</span>
            <span class="changelog-date">${entry.date}</span>
          </div>
          <div class="changelog-content">
            ${entry.content}
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load changelog. Please try again later.</p>';
  }
}

function animateValue(element, start, end, duration) {
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (range * easeOut));
    
    element.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.count);
        animateValue(entry.target, 0, target, 2000);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(counter => observer.observe(counter));
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      const navHeight = document.querySelector('nav').offsetHeight;
      const targetPosition = target.offsetTop - navHeight - 20;
      
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

window.loadChangelog = loadChangelog;
window.showToast = showToast;
