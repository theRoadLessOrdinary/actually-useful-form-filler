/**
 * Delete In Place Web Component
 * Shows a delete button that changes to a confirmation on click
 */

class DeleteInPlace extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    const caption = this.getAttribute('caption') || 'delete';
    const confirm = this.getAttribute('confirm') || 'confirm?';

    const params = {};
    for (const attr of this.attributes) {
      if (!['caption', 'confirm', 'class'].includes(attr.name)) {
        params[attr.name] = attr.value;
      }
    }

    this.innerHTML = `
      <span style="position:relative;display:inline-block;">
        <a class="dip-delete" style="cursor:pointer;color:#ef4444;font-weight:600;">${caption}</a>
        <a class="dip-confirm" style="color:green;cursor:pointer;display:none;font-weight:600;">${confirm}</a>
      </span>`;

    this._timer = null;
    this._delEl = this.querySelector('.dip-delete');
    this._conEl = this.querySelector('.dip-confirm');

    this._delEl.addEventListener('click', () => {
      this._delEl.style.display = 'none';
      this._conEl.style.display = 'inline';
      this._timer = setTimeout(() => this._reset(), 5000);
    });

    this._conEl.addEventListener('click', () => {
      clearTimeout(this._timer);
      console.log('Confirm clicked, dispatching event with params:', params);
      this.dispatchEvent(new CustomEvent('dip-confirm', { bubbles: true, detail: params }));
      this._reset();
    });
  }

  _reset() {
    clearTimeout(this._timer);
    this._conEl.style.display = 'none';
    this._delEl.style.display = 'inline';
  }
}

customElements.define('delete-in-place', DeleteInPlace);
