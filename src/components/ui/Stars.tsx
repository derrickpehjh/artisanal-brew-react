interface StarsProps {
  rating: number
  size?: string
}

export default function Stars({ rating, size = 'text-sm' }: StarsProps) {
  return (
    <>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`material-symbols-outlined text-primary ${size}`}
          style={{ fontVariationSettings: `'FILL' ${i <= rating ? 1 : 0},'wght' 400,'GRAD' 0,'opsz' 24` }}
        >
          star
        </span>
      ))}
    </>
  )
}
