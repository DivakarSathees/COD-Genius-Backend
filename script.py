import sys
import math

def is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n in (2, 3):
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    r = math.isqrt(n)
    i = 5
    while i <= r:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True


def main():
    data = sys.stdin.read().strip().split()
    if not data:
        return
    tokens = data
    try:
        n = int(tokens[0])
    except:
        return
    vals = []
    for i in range(1, 1 + n):
        if i < len(tokens):
            try:
                vals.append(int(tokens[i]))
            except:
                vals.append(0)
        else:
            vals.append(0)
    for idx, dur in enumerate(vals, start=1):
        if is_prime(dur):
            print(f'Track {idx} ({dur}s): Prime Length')
        else:
            print(f'Track {idx} ({dur}s): Not Prime Length')


if __name__ == '__main__':
    main()
