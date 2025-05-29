import React, { useState } from 'react';
import ReactGA4 from 'react-ga4';
import { useFingerPrint } from '../hooks/useFingerPrint';

interface CompactFeedbackWidgetProps {
  title?: string;
  description?: string;
  themeColor?: string;
  textColor?: string;
}

export default function CompactFeedbackWidget({
  title = "Hey There 👋",
  description = "Let me know how I can make this better or just give me a 😊",
  themeColor = "#6930c3",
  textColor = "white",
}: CompactFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    message: '',
    rating: ''
  });
  const [isSending, setIsSending] = useState(false);
  const fingerprint = useFingerPrint();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rating || !fingerprint) return;
    
    setIsSending(true);
    
    try {
      // Convert rating to match API expectations
      const ratingMap: { [key: string]: string } = {
        'good': 'nice',
        'meh': 'meh', 
        'bad': 'bad'
      };

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: formData.email,
          message: formData.message,
          rate: ratingMap[formData.rating],
          visitorId: fingerprint,
          metadata: {
            dev: process.env.NODE_ENV === 'development'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Feedback sent successfully:', result);
      
      ReactGA4.event('feedback_submit', {
        feedback_rating: formData.rating,
        feedback_type: 'compact_widget',
        has_email: !!formData.email.trim(),
        has_message: !!formData.message.trim(),
        message_length: formData.message.trim().length
      });
      
      // Reset form and close
      setFormData({ email: '', message: '', rating: '' });
      setIsOpen(false);
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert(`Failed to send feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleRatingSelect = (rating: string) => {
    setFormData(prev => ({ ...prev, rating }));
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    ReactGA4.event('feedback_widget_toggle', {
      action: !isOpen ? 'open' : 'close',
      widget_type: 'compact_feedback',
      interaction_source: 'trigger_button'
    });
  };

  return (
    <div className={`feedback-widget-compact ${isOpen ? 'show' : ''}`}>
      {/* Trigger Button */}
      <div className="feedback-widget-compact-trigger" onClick={toggleOpen}>
        <span className="feedback-widget-compact-icon">
          {isOpen ? '✕' : '👋'}
        </span>
        <span className="feedback-widget-compact-text">
          {isOpen ? 'Close' : 'Feedback'}
        </span>
      </div>

      {/* Modal Content */}
      <div className="feedback-widget-compact-modal">
        <div className="feedback-widget-compact-header">
          <div className="feedback-widget-compact-title">{title}</div>
          <div className="feedback-widget-compact-description">{description}</div>
        </div>

        <form className="feedback-widget-compact-form" onSubmit={handleSubmit}>
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email (optional)"
            className="feedback-widget-compact-input"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />

          {/* Message Textarea */}
          <textarea
            placeholder="Message (optional)"
            className="feedback-widget-compact-textarea"
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          />

          {/* Rating Options */}
          <div className="feedback-widget-compact-rate">
            <div 
              className={`feedback-widget-compact-rate-option ${formData.rating === 'bad' ? 'selected' : ''}`}
              onClick={() => handleRatingSelect('bad')}
            >
              <div className="feedback-widget-compact-rate-emoji">😞</div>
              <div className="feedback-widget-compact-rate-label">Bad</div>
            </div>
            <div 
              className={`feedback-widget-compact-rate-option ${formData.rating === 'meh' ? 'selected' : ''}`}
              onClick={() => handleRatingSelect('meh')}
            >
              <div className="feedback-widget-compact-rate-emoji">😐</div>
              <div className="feedback-widget-compact-rate-label">Meh</div>
            </div>
            <div 
              className={`feedback-widget-compact-rate-option ${formData.rating === 'good' ? 'selected' : ''}`}
              onClick={() => handleRatingSelect('good')}
            >
              <div className="feedback-widget-compact-rate-emoji">😊</div>
              <div className="feedback-widget-compact-rate-label">Good</div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="feedback-widget-compact-submit"
            disabled={isSending || !formData.rating || !fingerprint}
          >
            {isSending ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
} 