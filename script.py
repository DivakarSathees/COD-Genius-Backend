import sys
import math

def is_prime(n):
    if n <= 1:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    sqrt_n = math.isqrt(n)
    for i in range(3, sqrt_n + 1, 2):
        if n % i == 0:
            return False
    return True

def main():
    try:
        lower_bound = int(sys.stdin.readline().strip())
        upper_bound = int(sys.stdin.readline().strip())
        prime_numbers = [str(i) for i in range(lower_bound, upper_bound + 1) if is_prime(i)]
        print('\n'.join(prime_numbers))
    except Exception as e:
        pass

if __name__ == '__main__':
    main()