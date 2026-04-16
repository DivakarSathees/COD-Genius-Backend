import sys
def is_prime_age(age):
    if age <= 1:
        return False
    if age == 2:
        return True
    if age % 2 == 0:
        return False
    max_divisor = int(age**0.5) + 1
    for d in range(3, max_divisor, 2):
        if age % d == 0:
            return False
    return True

for line in sys.stdin:
    try:
        age = int(line.strip())
        if is_prime_age(age):
            print("Valid")
        else:
            print("Invalid")
    except ValueError:
        pass