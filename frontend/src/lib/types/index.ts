export interface RecognitionResult {
  text: string
  utterances?: Array<{
    text: string
    start_time: number
    end_time: number
    definite: boolean
  }>
  isFinal: boolean
}
