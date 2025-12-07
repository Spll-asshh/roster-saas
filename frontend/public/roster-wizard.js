(function (window, document) {
  'use strict';

  function toggleStepVisibility(step, isActive) {
    if (!step || !step.classList) {
      return;
    }

    var active = !!isActive;
    step.classList.toggle('is-active', active);
    step.hidden = !active;
    step.setAttribute('aria-hidden', active ? 'false' : 'true');

    if (active) {
      step.removeAttribute('hidden');
      step.removeAttribute('inert');
    } else {
      step.setAttribute('hidden', '');
      step.setAttribute('inert', '');
    }
  }

  function findActiveIndex(steps) {
    for (var i = 0; i < steps.length; i += 1) {
      if (steps[i].classList && steps[i].classList.contains('is-active')) {
        return i;
      }
    }
    return -1;
  }

  function setupWizard() {
    var steps = Array.prototype.slice.call(document.querySelectorAll('[data-wizard-step]'));
    if (!steps.length) {
      return;
    }

    var continueButton = document.querySelector('[data-action="wizard-continue"]');
    if (!continueButton) {
      return;
    }

    var activeIndex = findActiveIndex(steps);
    if (activeIndex === -1) {
      activeIndex = 0;
    }

    steps.forEach(function (step, index) {
      toggleStepVisibility(step, index === activeIndex);
    });

    if (continueButton.dataset && continueButton.dataset.bound === '1') {
      return;
    }

    if (continueButton.dataset) {
      continueButton.dataset.bound = '1';
    }

    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[roster-wizard] continue bound');
    }

    var advance = function () {
      try {
        var current = findActiveIndex(steps);
        var next = current + 1;
        if (next >= steps.length) {
          return false;
        }
        steps.forEach(function (step, index) {
          toggleStepVisibility(step, index === next);
        });
        return true;
      } catch (err) {
        console.error('[roster-wizard] Failed to advance wizard step:', err);
        return false;
      }
    };

    continueButton.addEventListener('click', function (event) {
      var advanced = advance();
      if (advanced && event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    });
  }

  function initWizard() {
    try {
      setupWizard();
    } catch (err) {
      console.warn('[roster-wizard] Non-fatal init error:', err && err.message ? err.message : err);
    }
  }

  document.addEventListener('DOMContentLoaded', initWizard);

  if (document.readyState !== 'loading') {
    initWizard();
  }
})(window, document);
