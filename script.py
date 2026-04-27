def reverse_tagline(tagline):
    if not tagline or len(tagline) > 400 or any(ord(c) < 32 or ord(c) > 126 for c in tagline):
        return "Invalid input"
    words = tagline.split()
    return " ".join(reversed(words))

if __name__ == "__main__":
    import sys
    input_line = sys.stdin.read().strip()
    result = reverse_tagline(input_line)
    print(result)