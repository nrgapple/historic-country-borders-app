import React, { useState } from 'react';
import ReactGA4 from 'react-ga4';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rating) return;
    
    setIsSending(true);
    
    try {
      // Send feedback (you can implement your API call here)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      ReactGA4.event({
        category: 'Feedback',
        action: `${formData.rating}`,
        label: 'compact-feedback',
      });
      
      // Reset form and close
      setFormData({ email: '', message: '', rating: '' });
      setIsOpen(false);
    } catch (error) {
      console.error('Feedback submission error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleRatingSelect = (rating: string) => {
    setFormData(prev => ({ ...prev, rating }));
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    ReactGA4.event({
      category: 'Feedback',
      action: `${!isOpen ? 'opened' : 'closed'} compact feedback`,
      label: 'compact-feedback',
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
            disabled={isSending || !formData.rating}
          >
            {isSending ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
} 