import { useMemo, useState } from 'react'
import { Globe, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { vendorCategorySuggestions } from '../../lib/eventUtils'
import { sanitizeExternalUrl } from '../../lib/urlSafety'
import { getUserErrorMessage } from '../../lib/userError'

function isValidOptionalUrl(value) {
  if (!String(value || '').trim()) return true
  return Boolean(sanitizeExternalUrl(value))
}

export default function VendorProfileView({
  profile,
  vendorProfile,
  vendorImages,
  publicUpdates,
  reload,
  notify
}) {
  const [form, setForm] = useState({
    business_name: vendorProfile?.business_name || profile?.company_name || '',
    category: vendorProfile?.category || '',
    description: vendorProfile?.description || '',
    website_url: vendorProfile?.website_url || '',
    instagram_url: vendorProfile?.instagram_url || '',
    facebook_url: vendorProfile?.facebook_url || '',
    tiktok_url: vendorProfile?.tiktok_url || '',
    logo_url: vendorProfile?.logo_url || '',
    public_visible: vendorProfile?.public_visible ?? true
  })
  const [imageForm, setImageForm] = useState({ image_url: '', caption: '' })
  const [updateForm, setUpdateForm] = useState({ title: '', body: '', public_visible: true })
  const [saving, setSaving] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [savingUpdate, setSavingUpdate] = useState(false)
  const profileUpdates = useMemo(
    () => publicUpdates.filter(item => item.vendor_profile_id === vendorProfile?.id),
    [publicUpdates, vendorProfile]
  )

  async function saveVendorProfile(event) {
    event.preventDefault()
    if (saving) return

    if (!String(form.business_name || '').trim()) {
      notify?.('error', 'Der Händlername ist Pflicht.')
      return
    }

    for (const [key, label] of [
      ['website_url', 'Webseite'],
      ['instagram_url', 'Instagram'],
      ['facebook_url', 'Facebook'],
      ['tiktok_url', 'TikTok'],
      ['logo_url', 'Logo']
    ]) {
      if (!isValidOptionalUrl(form[key])) {
        notify?.('error', `${label} hat keine gültige URL.`)
        return
      }
    }

    setSaving(true)
    try {
      const sanitizedUrls = {
        website_url: sanitizeExternalUrl(form.website_url),
        instagram_url: sanitizeExternalUrl(form.instagram_url),
        facebook_url: sanitizeExternalUrl(form.facebook_url),
        tiktok_url: sanitizeExternalUrl(form.tiktok_url),
        logo_url: sanitizeExternalUrl(form.logo_url)
      }

      const payload = {
        owner_id: profile.id,
        business_name: form.business_name.trim(),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        website_url: sanitizedUrls.website_url || null,
        instagram_url: sanitizedUrls.instagram_url || null,
        facebook_url: sanitizedUrls.facebook_url || null,
        tiktok_url: sanitizedUrls.tiktok_url || null,
        logo_url: sanitizedUrls.logo_url || null,
        public_visible: Boolean(form.public_visible)
      }

      const query = vendorProfile?.id
        ? supabase.from('vendor_profiles').update(payload).eq('id', vendorProfile.id)
        : supabase.from('vendor_profiles').insert(payload)

      const { error } = await query
      if (error) throw error
      await reload()
      notify?.('success', vendorProfile?.id ? 'Händlerprofil aktualisiert.' : 'Händlerprofil angelegt.')
    } catch (error) {
      notify?.('error', getUserErrorMessage(error, 'Händlerprofil konnte nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }

  async function addImage(event) {
    event.preventDefault()
    if (!vendorProfile?.id) {
      notify?.('error', 'Bitte speichere zuerst dein Händlerprofil.')
      return
    }
    if (savingImage) return
    if (!isValidOptionalUrl(imageForm.image_url)) {
      notify?.('error', 'Bitte gib eine gültige Bild-URL an.')
      return
    }

    setSavingImage(true)
    try {
      const imageUrl = sanitizeExternalUrl(imageForm.image_url)
      const { error } = await supabase.from('vendor_images').insert({
        vendor_profile_id: vendorProfile.id,
        image_url: imageUrl,
        caption: imageForm.caption.trim() || null,
        sort_order: vendorImages.length
      })
      if (error) throw error
      setImageForm({ image_url: '', caption: '' })
      await reload()
      notify?.('success', 'Bild hinzugefügt.')
    } catch (error) {
      notify?.('error', getUserErrorMessage(error, 'Bild konnte nicht gespeichert werden.'))
    } finally {
      setSavingImage(false)
    }
  }

  async function removeImage(imageId) {
    try {
      const { error } = await supabase.from('vendor_images').delete().eq('id', imageId)
      if (error) throw error
      await reload()
      notify?.('success', 'Bild entfernt.')
    } catch (error) {
      notify?.('error', getUserErrorMessage(error, 'Bild konnte nicht entfernt werden.'))
    }
  }

  async function addUpdate(event) {
    event.preventDefault()
    if (!vendorProfile?.id) {
      notify?.('error', 'Bitte speichere zuerst dein Händlerprofil.')
      return
    }
    if (!String(updateForm.title || '').trim() || !String(updateForm.body || '').trim()) {
      notify?.('error', 'Titel und Text für das Update sind Pflicht.')
      return
    }
    setSavingUpdate(true)
    try {
      const { error } = await supabase.from('public_updates').insert({
        author_id: profile.id,
        vendor_profile_id: vendorProfile.id,
        title: updateForm.title.trim(),
        body: updateForm.body.trim(),
        public_visible: Boolean(updateForm.public_visible)
      })
      if (error) throw error
      setUpdateForm({ title: '', body: '', public_visible: true })
      await reload()
      notify?.('success', 'Öffentliches Update gespeichert.')
    } catch (error) {
      notify?.('error', getUserErrorMessage(error, 'Update konnte nicht gespeichert werden.'))
    } finally {
      setSavingUpdate(false)
    }
  }

  return (
    <div className="grid two vendor-profile-layout" data-testid="vendor-profile-view">
      <div className="card">
        <h2>Händlerprofil bearbeiten</h2>
        <p className="muted">
          Dieses Profil ist die öffentliche Seite für Besucher. Je klarer es hier ist, desto besser
          funktioniert die Plattform für dich.
        </p>
        <button
          className="btn ghost promotion-info-button"
          data-testid="vendor-promotion-info"
          onClick={() =>
            notify?.('success', 'Händlerprofil-Hervorhebungen werden später als bezahlte Option verfügbar.')
          }
          type="button"
        >
          Händlerprofil hervorheben - demnächst verfügbar
        </button>

        <form className="event-form" onSubmit={saveVendorProfile}>
          <div className="field-group">
            <label>Händlername *</label>
            <input
              className="input"
              data-testid="vendor-business-name"
              value={form.business_name}
              onChange={event => setForm(current => ({ ...current, business_name: event.target.value }))}
            />
          </div>

          <div className="field-group">
            <label>Kategorie</label>
            <input
              className="input"
              data-testid="vendor-category"
              list="vendor-category-suggestions"
              placeholder="z. B. Keramik"
              value={form.category}
              onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
            />
            <datalist id="vendor-category-suggestions">
              {vendorCategorySuggestions.map(category => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <p className="muted">Du kannst eine Kategorie auswählen oder freien Text eintragen.</p>
          </div>

          <div className="field-group">
            <label>Beschreibung</label>
            <textarea
              data-testid="vendor-description"
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
            />
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label>Webseite</label>
              <input
                className="input"
                data-testid="vendor-website"
                value={form.website_url}
                onChange={event => setForm(current => ({ ...current, website_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="field-group">
              <label>Instagram-Link</label>
              <input
                className="input"
                data-testid="vendor-instagram"
                value={form.instagram_url}
                onChange={event => setForm(current => ({ ...current, instagram_url: event.target.value }))}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="field-group">
              <label>Facebook-Link</label>
              <input
                className="input"
                data-testid="vendor-facebook"
                value={form.facebook_url}
                onChange={event => setForm(current => ({ ...current, facebook_url: event.target.value }))}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="field-group">
              <label>TikTok-Link</label>
              <input
                className="input"
                data-testid="vendor-tiktok"
                value={form.tiktok_url}
                onChange={event => setForm(current => ({ ...current, tiktok_url: event.target.value }))}
                placeholder="https://tiktok.com/@..."
              />
            </div>
          </div>

          <div className="field-group">
            <label>Logo/Bild-URL</label>
            <input
              className="input"
              data-testid="vendor-logo-url"
              value={form.logo_url}
              onChange={event => setForm(current => ({ ...current, logo_url: event.target.value }))}
              placeholder="https://..."
            />
          </div>

          <label className="checkbox-row">
            <input
              checked={Boolean(form.public_visible)}
              data-testid="vendor-public-visible"
              onChange={event => setForm(current => ({ ...current, public_visible: event.target.checked }))}
              type="checkbox"
            />
            <span>Profil öffentlich anzeigen</span>
          </label>

          <button className="btn sticky-save-button" data-testid="vendor-save-profile" disabled={saving}>
            <Globe size={16} /> {saving ? 'Speichert...' : 'Händlerprofil speichern'}
          </button>
        </form>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Warenbilder</h2>
          <p className="muted">Bilder helfen beim Wiedererkennen, sind aber keine Pflicht.</p>

          <form className="event-form" onSubmit={addImage}>
            <div className="field-group">
              <label>Bild-URL</label>
              <input
                className="input"
                data-testid="vendor-image-url"
                value={imageForm.image_url}
                onChange={event => setImageForm(current => ({ ...current, image_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="field-group">
              <label>Bildtext</label>
              <input
                className="input"
                data-testid="vendor-image-caption"
                value={imageForm.caption}
                onChange={event => setImageForm(current => ({ ...current, caption: event.target.value }))}
              />
            </div>
            <button className="btn secondary" data-testid="vendor-add-image" disabled={savingImage}>
              <Plus size={16} /> {savingImage ? 'Speichert...' : 'Bild hinzufügen'}
            </button>
          </form>

          <div className="public-image-grid compact">
            {vendorImages.length === 0 && <p className="muted">Noch keine Warenbilder vorhanden.</p>}
            {vendorImages.map(image => (
              <figure className="public-image-card" key={image.id}>
                {sanitizeExternalUrl(image.image_url) ? (
                  <img alt={image.caption || 'Warenbild'} src={sanitizeExternalUrl(image.image_url)} />
                ) : (
                  <div className="public-vendor-placeholder">Bild nicht verfügbar</div>
                )}
                <figcaption>{image.caption || 'Ohne Bildtext'}</figcaption>
                <button
                  className="btn ghost danger-inline"
                  data-testid="vendor-remove-image"
                  onClick={() => removeImage(image.id)}
                  type="button"
                >
                  <Trash2 size={16} /> Entfernen
                </button>
              </figure>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Öffentliche Updates</h2>
          <p className="muted">Kurze Hinweise für Besucher und Fans, die deinem Profil folgen.</p>
          <form className="event-form" onSubmit={addUpdate}>
            <div className="field-group">
              <label>Titel</label>
              <input
                className="input"
                data-testid="vendor-update-title"
                value={updateForm.title}
                onChange={event => setUpdateForm(current => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>Text</label>
              <textarea
                data-testid="vendor-update-body"
                value={updateForm.body}
                onChange={event => setUpdateForm(current => ({ ...current, body: event.target.value }))}
              />
            </div>
            <label className="checkbox-row">
              <input
                checked={Boolean(updateForm.public_visible)}
                data-testid="vendor-update-visible"
                onChange={event => setUpdateForm(current => ({ ...current, public_visible: event.target.checked }))}
                type="checkbox"
              />
              <span>Öffentlich sichtbar</span>
            </label>
            <button className="btn secondary" data-testid="vendor-save-update" disabled={savingUpdate}>
              <Plus size={16} /> {savingUpdate ? 'Speichert...' : 'Update veröffentlichen'}
            </button>
          </form>

          <div className="list">
            {profileUpdates.length === 0 && <p className="muted">Noch keine öffentlichen Updates vorhanden.</p>}
            {profileUpdates.map(update => (
              <div className="item" key={update.id}>
                <strong>{update.title}</strong>
                <p className="muted">{update.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
