import React from 'react';
import { useSelector } from 'react-redux';
import SubTabNav from './SubTabNav';
import LanguageBar from './LanguageBar';
import TemplateManager from './TemplateManager';
import SignatureManager from './SignatureManager';
import PromptEditor from './PromptEditor';

export default function EmailSection() {
  const activeSubtab = useSelector((s) => s.experience.activeSubtab);
  const showLanguage = activeSubtab === 'templates' || activeSubtab === 'signatures';

  return (
    <div className="exp-section">
      <div className="exp-section__bar">
        <SubTabNav />
        {showLanguage && (
          <>
            <span className="exp-section__bar-spacer" />
            <LanguageBar />
          </>
        )}
      </div>
      <div className="exp-section__body">
        {activeSubtab === 'templates' && <TemplateManager />}
        {activeSubtab === 'signatures' && <SignatureManager />}
        {activeSubtab === 'prompt' && <PromptEditor />}
      </div>
    </div>
  );
}
