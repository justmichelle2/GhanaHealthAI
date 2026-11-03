# Speech model assessment

Assessment date: 2026-11-03. This is a shortlist for controlled evaluation, not a clinical recommendation. No model weights or inference packages have been installed, and no patient audio should be sent to third-party services.

## Languages in the product

| Product language | ASR checkpoint reviewed | TTS checkpoint reviewed | Current decision |
|---|---|---|---|
| English | Whisper-small and DONDO checkpoint | Ghana-audiodit / Ghana TTS v2 | Evaluate with Ghanaian English audio; no local benchmark sufficient to select today. |
| Twi | DONDO lists Asante Twi; Whisper has no Twi language token | Ghana-audiodit lists Asante/Akuapem Twi; Ghana TTS v2 claims 41 local languages but its public card does not enumerate them | Prioritize a locally collected, consented benchmark covering dialects and code switching. |
| Ewe | DONDO lists Ewe; Whisper has no Ewe language token | Ghana-audiodit lists Ewe; Ghana TTS v2 exact coverage is not enumerated | Benchmark pronunciation and comprehension with Ewe speakers. |
| Ga | DONDO lists Ga; Whisper has no Ga language token | Exact Ga coverage was not established from reviewed public cards | Do not promise Ga speech support until a checkpoint and evaluation are identified. |
| Hausa | Whisper tokenizer includes Hausa; DONDO's specific checkpoint does not list Hausa | MMS Hausa TTS exists, but has a non-commercial license; Ghana-audiodit lists Hausa | Measure dialect coverage and quality. Do not use non-commercial weights in a commercial service without a separate rights review. |

Language tags are evidence of intended support, not evidence of clinical accuracy. Text preference support in the web app does not mean speech support exists.

## ASR candidates

### DONDO multilingual checkpoint

The [checkpoint card](https://huggingface.co/KhayaAI/w2v-bert-ada_ewe_fat_fra_gaa_nzi_twi_en) lists English, Adangme, Ewe, Fante, French, Ga, Nzema, and Asante Twi. It reports Apache-2.0 weights, about 0.6B parameters and float32 weights. Its card's reported average WER is 11.4%, with 16.0 for Ga, 14.7 for Asante Twi, 6.57 for Ewe, and 27.4 for English. These are card-reported results on its evaluation data, not a Ghanaian patient-speech benchmark. The card describes training data dominated by read religious text. The family language map includes Hausa, but Hausa is not listed for this particular checkpoint; do not infer support from the family map.

At roughly 2.4 GB for float32 parameters alone, this is a poor default for an 8 GB Windows machine once the OS, browser, API, and runtime memory are included. Do not download it locally for this project yet.

### Whisper-small

The [OpenAI Whisper-small model card](https://huggingface.co/openai/whisper-small) describes 244M parameters and broad multilingual transcription. The [official tokenizer](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py) has a Hausa token, but no Twi, Ewe, or Ga tokens. Token availability is not a quality guarantee. The model card warns that performance varies by language and recommends task-specific evaluation; no reliable Ghanaian patient-speech result was found for this assessment.

The Hugging Face model card labels the weights Apache-2.0; the [OpenAI Whisper source repository](https://github.com/openai/whisper/blob/main/LICENSE) uses MIT for source code. Treat weight and code licensing as separate review items.

## TTS candidates

- [Ghana AudioDiT](https://huggingface.co/ghananlpcommunity/ghana-audiodit) lists Ghanaian languages including Twi, Ewe, and Hausa. The card says the float32 model is about 1.42B parameters / 5.7 GB, weights are CC-BY-NC-4.0, outputs are 24 kHz, and it does not ship reliable voice cloning. Formal read-aloud training text and number handling are limitations. It is unsuitable for local deployment on this 8 GB machine and its non-commercial license needs review.
- [Ghana TTS v2](https://huggingface.co/ghananlpcommunity/ghana-tts-v2) advertises 41 indigenous Ghanaian languages plus Ghanaian English and an Apache-2.0 license. The public card reviewed did not enumerate exact language coverage or provide enough deployment and quality evidence to confirm Twi, Ewe, Ga, and Hausa. Treat it as an evaluation lead only.
- [MMS Hausa TTS](https://huggingface.co/facebook/mms-tts-hau) is a language-specific Hausa candidate, but its CC-BY-NC-4.0 model license is non-commercial. It does not address the other four languages.

## Recommendation and evaluation gate

Keep the app's microphone and speech output disabled. Do not download any of these models on the current machine. First obtain explicit rights and privacy review, then use a separate evaluation environment and a consented, de-identified dataset with speaker-balanced examples. Include dialects, Ghanaian English, code-switching, ordinary room noise, names, numbers, medicine terms, and urgent-care vocabulary. Report WER/CER by language and subgroup, latency, peak RAM, failure rate, and human-rated comprehension. For TTS, add native-speaker ratings for intelligibility, pronunciation, tone, and numbers. Establish a clinician-approved fallback whenever speech confidence is low; speech output must not turn uncertain content into authoritative advice.

No ASR or TTS package, model, endpoint, or generated patient-facing response has been added to the application.
