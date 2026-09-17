function FlowArrow() {
  return (
    <svg className="translationArrow" viewBox="0 0 32 16" aria-hidden="true">
      <path d="M1 8h28m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TranslatorFigure() {
  return (
    <figure className="translatorFigure resultsWide" aria-labelledby="translator-title">
      <div className="translationHeading">
        <h4 id="translator-title">Translator architecture</h4>
      </div>

      <div className="translationFlow">
        <div className="translationStage translationRequest">
          <div className="translationLabel"><span>01</span> Agent request</div>
          <div className="translationBody">
            <blockquote>“Check coverage,<br />submit the appeal,<br />and book a ride.”</blockquote>
            <span className="translationFoot">Natural language</span>
          </div>
        </div>

        <FlowArrow />

        <div className="translationStage translationMatch">
          <div className="translationLabel"><span>02</span> Luna translator</div>
          <div className="translationBody">
            <div className="translationMenuHead"><span>Request</span><span>Party menu</span></div>
            <div className="translationMenuRow"><span>Check coverage</span><span>Coverage status</span></div>
            <div className="translationMenuRow"><span>Submit appeal</span><span>Submit appeal</span></div>
            <div className="translationMenuRow translationUnmatched"><span>Book a ride</span><span>No match</span></div>
            <span className="translationFoot">Match to available operations</span>
          </div>
        </div>

        <FlowArrow />

        <div className="translationStage translationEngine">
          <div className="translationLabel"><span>03</span> Deterministic engine</div>
          <div className="translationBody">
            <div className="translationState">Environment state <span>t</span></div>
            <span className="translationResolve">↓ <span>Resolve</span> ↓</span>
            <div className="translationDecisions"><span>Coverage <b>Active</b></span><span>Appeal <b>Submitted</b></span></div>
            <span className="translationStateArrow" aria-hidden="true">↓</span>
            <div className="translationState translationStateNext">Environment state <span>t + 1</span></div>
          </div>
        </div>

        <FlowArrow />

        <div className="translationStage translationReply">
          <div className="translationLabel"><span>04</span> Party reply</div>
          <div className="translationBody">
            <dl>
              <div><dt>Coverage</dt><dd>Active</dd></div>
              <div><dt>Appeal</dt><dd>Submitted</dd></div>
              <div className="translationUnavailable"><dt>Ride booking</dt><dd>Unavailable</dd></div>
            </dl>
            <span className="translationFoot">Checked against the engine result</span>
          </div>
        </div>
      </div>
      <figcaption>The translation layer allows agents to interact naturally with simulated parties while keeping the underlying environment deterministic.</figcaption>
    </figure>
  );
}
