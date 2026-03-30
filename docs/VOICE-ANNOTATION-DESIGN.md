# Voice Annotation Design

Voice is a future acceleration layer, not part of the browser-first MVP. The typed annotation flow must prove repeat value first.

## Why Voice Matters for Contextual

Voice is the most natural way to provide context in meetings, reviews, and critiques. If the typed loop proves valuable, voice can make that same loop faster.

## Voice Interaction Model

### Primary Flow
1. **Activate** - ⌘+Shift+C (or hold for continuous mode)
2. **Click** - Target any UI element
3. **Speak** - Natural language with @mentions
4. **Confirm** - Preview shows resolved context
5. **Execute** - ⌘+Enter copies formatted output

### Voice Input Examples

#### Simple Corrections
"Make this bigger"
"Too much space here"
"Wrong color"

#### Context-Rich Annotations
"This button needs to match @research[what users said about saving] and follow @taste[Stripe's CTA style]"

"Fix the spacing based on @design-system[card padding] but tighter because @stakeholders[John said it feels too loose]"

"Make this feel more @taste[Apple premium] but remember @strategy[accessibility standards]"

#### Natural Queries
"Why does this look wrong? Check @research[what users said about this step]"
"What did @stakeholders[the team say about this]?"
"Find @research[anything about checkout friction]"

## Voice-Specific Features

### 1. Continuous Mode
Hold ⌘+Shift+C for multiple annotations:
- Click → speak → click → speak
- Great for design reviews
- Release to finish batch

### 2. Context Stacking
Voice naturally allows multiple references:
"Make this like @taste[Linear] meets @taste[Notion] with @research[our user's mental model]"

### 3. Thinking Out Loud
Capture design reasoning:
"I'm making this red because @research[users associate urgency] but not too bright because @taste[accessibility matters]"

### 4. Quick Notes
"Note: @stakeholders[stakeholder wants this bigger but I think it's fine]"
- Captures context without immediate action

## Voice UI/UX

### Visual Feedback
- **Listening state** - Pulsing indicator
- **Processing** - Show transcription in real-time
- **Context resolution** - Highlight found @mentions
- **Confidence indicator** - Show when unclear

### Audio Feedback
- **Activation sound** - Subtle tone
- **Completion chime** - Confirms capture
- **Error sound** - When no context found

### Voice Commands
- "Cancel" - Abort current annotation
- "Clear" - Start over
- "Show context" - Preview what was found
- "Copy" - Alternative to ⌘+Enter

## Technical Implementation

### Native Expansion Path
- **NSSpeechRecognizer** or **Speech framework**
- On-device processing (privacy + speed)
- Fallback to dictation API if needed

### Smart Processing
1. **Live transcription** - See words as you speak
2. **@mention detection** - Highlight in real-time
3. **Context preview** - Show matches while speaking
4. **Natural language** - No rigid syntax required

### Voice-Optimized Search
- Phonetic matching ("figma" matches "Figma")
- Common mishears ("slack" vs "select")
- Contextual correction based on project

## Privacy & Performance

### Local Processing
- Voice never leaves device
- No cloud transcription by default
- Option for enhanced accuracy via cloud

### Performance
- Instant activation (< 50ms)
- Real-time transcription
- Background context indexing
- Efficient partial matching

## The Magic Moment

Designer in a review meeting:
1. Sees confusing button
2. ⌘+Shift+C + click
3. "This should be clearer based on what users said"
4. Contextual finds: "@research[70% of users couldn't find save - session 3]"
5. Copies annotation with full context
6. Pastes into Claude
7. Gets informed fix based on actual user feedback

This only becomes relevant after the typed browser loop is working and retained.

## Future Enhancements

- **Multi-language** support
- **Speaker detection** in meetings
- **Emotion detection** for emphasis
- **Auto-summary** of long annotations
- **Voice shortcuts** for common patterns
